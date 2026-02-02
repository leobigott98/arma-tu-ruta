// src/screens/GameScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  LayoutRectangle,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  PHOTOS,
  GAME_RULES,
  LANDMARKS,
  PhotoItem,
  LandmarkId,
} from "../game/config";

type PlacedMap = Record<
  string,
  { placed: boolean; lockedTo: LandmarkId | null }
>;

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function distance(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * For ANY showCount, compute rows that look good:
 * - Choose a max number of columns based on n.
 * - Fill rows with that many columns, last row centered.
 *
 * You can tune MAX_COLS_CAP for aesthetics.
 */
function getRowCountsAny(n: number) {
  if (n <= 0) return [];
  // A nice cap for portrait kiosk (keeps squares big)
  const MAX_COLS_CAP = 4;

  // Start with sqrt-based cols, clamp to [3..MAX_COLS_CAP] for nicer look
  const approx = Math.ceil(Math.sqrt(n));
  const cols = Math.max(4, Math.min(MAX_COLS_CAP, approx));

  const rows: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    rows.push(Math.min(cols, remaining));
    remaining -= cols;
  }
  return rows;
}

type Slot = {
  id: string; // photo id
  x: number; // absolute screen coords
  y: number;
  size: number;
};

const BORDER_COLORS = [
  "#0B2B6D",
  "#E53935",
  "#F2C200",
  "#E67E22",
  "#00ACC1",
  "#4CAF50",
  "#8E44AD",
];

const MAP_SCALE = 0.50;

function DraggablePhoto(props: {
  item: PhotoItem;
  size: number;
  startPos: { x: number; y: number };
  disabled: boolean;
  placed: boolean; // NEW
  mapScale?: number; // NEW
  onDrop: (
    item: PhotoItem,
    center: { x: number; y: number },
    reset: () => void,
    snapTo: (x: number, y: number) => void,
  ) => void;
}) {
  const {
    item,
    size,
    startPos,
    disabled,
    onDrop,
    placed,
    mapScale = MAP_SCALE,
  } = props;

  const pan = useRef(
    new Animated.ValueXY({ x: startPos.x, y: startPos.y }),
  ).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // New round: reset position + scale
    pan.setValue({ x: startPos.x, y: startPos.y });
    scale.setValue(1);
  }, [startPos.x, startPos.y]);

  useEffect(() => {
    // When the item becomes placed, animate scale down (shrink-on-drop)
    // When it becomes unplaced (new round), animate back to full size
    if (placed) {
      // ✅ "snap + bounce" on drop (scale overshoot then settle)
      Animated.sequence([
        Animated.spring(scale, {
          toValue: mapScale * 1.08,
          useNativeDriver: false,
          friction: 6,
          tension: 140,
        }),
        Animated.spring(scale, {
          toValue: mapScale,
          useNativeDriver: false,
          friction: 7,
          tension: 120,
        }),
      ]).start();
    } else {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: false,
        friction: 7,
        tension: 110,
      }).start();
    }
  }, [placed, mapScale]);

  const reset = () => {
    Animated.parallel([
      Animated.spring(pan, {
        toValue: { x: startPos.x, y: startPos.y },
        useNativeDriver: false,
        friction: 6,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: false,
        friction: 7,
        tension: 90,
      }),
    ]).start();
  };

  const snapTo = (x: number, y: number) => {
    // Snap position; scale is handled by placed state (setPlaced in GameScreen)
    Animated.spring(pan, {
      toValue: { x, y },
      useNativeDriver: false,
      friction: 5, // lower = bouncier
      tension: 140, // higher = snappier
    }).start();
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: () => {
          pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => {
          pan.flattenOffset();

          const x = (pan.x as any)._value;
          const y = (pan.y as any)._value;
          const center = { x: x + size / 2, y: y + size / 2 };

          onDrop(item, center, reset, snapTo);
        },
      }),
    [disabled, item.id, size, startPos.x, startPos.y],
  );

  return (
  <Animated.View
    style={[
      styles.photo,
      { width: size, height: size, transform: pan.getTranslateTransform(), borderWidth: 0, elevation: 0 }
    ]}
    {...responder.panHandlers}
  >
    <Animated.View style={{ width: "100%", height: "100%", transform: [{ scale }] }}>
      <Image source={item.source} style={styles.photoImg} />
    </Animated.View>
  </Animated.View>
);

}

export default function GameScreen(props: { onExitToStart: () => void }) {
  const { onExitToStart } = props;

  const [mapAreaLayout, setMapAreaLayout] = useState<LayoutRectangle | null>(
    null,
  );
  const [gridLayout, setGridLayout] = useState<LayoutRectangle | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(GAME_RULES.seconds);
  const [mistakesLeft, setMistakesLeft] = useState(GAME_RULES.maxMistakes);

  const [roundPhotos, setRoundPhotos] = useState<PhotoItem[]>([]);
  const [placed, setPlaced] = useState<PlacedMap>({});
  const [status, setStatus] = useState<"playing" | "win" | "lose">("playing");
  const [requiredToWin, setRequiredToWin] = useState(
    GAME_RULES.requiredCorrect,
  );

  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === "win" || status === "lose") {
      overlayAnim.setValue(0);
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: false,
        }),
        Animated.spring(overlayAnim, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [status]);

  // Debug tap-to-log coords inside map area
  const DEBUG_PICK_TARGETS = true;

  const newRound = () => {
    const count = Math.max(1, Math.min(GAME_RULES.showCount, PHOTOS.length));
    const picked = shuffle(PHOTOS).slice(0, count);

    setRoundPhotos(picked);
    setRequiredToWin(GAME_RULES.requiredCorrect);

    const init: PlacedMap = {};
    picked.forEach((p) => (init[p.id] = { placed: false, lockedTo: null }));
    setPlaced(init);

    setSecondsLeft(GAME_RULES.seconds);
    setMistakesLeft(GAME_RULES.maxMistakes);
    setStatus("playing");
  };

  useEffect(() => {
    newRound();
  }, []);

  // Timer
  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(
      () => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== "playing") return;
    if (secondsLeft <= 0) setStatus("lose");
  }, [secondsLeft, status]);

  const correctPlacedCount = useMemo(() => {
    return roundPhotos.reduce(
      (acc, p) => (placed[p.id]?.placed ? acc + 1 : acc),
      0,
    );
  }, [roundPhotos, placed]);

  useEffect(() => {
    if (status !== "playing") return;
    if (correctPlacedCount >= requiredToWin) setStatus("win");
  }, [correctPlacedCount, requiredToWin, status]);

  useEffect(() => {
    if (status === "win" || status === "lose") {
      const timeout = setTimeout(() => onExitToStart(), 5000);
      return () => clearTimeout(timeout);
    }
  }, [status, onExitToStart]);

  // --- Dynamic grid slots (ABSOLUTE COORDS) ---
  const rowCounts = useMemo(
    () => getRowCountsAny(roundPhotos.length),
    [roundPhotos.length],
  );

  const slots = useMemo<Slot[]>(() => {
    if (!gridLayout) return [];
    if (roundPhotos.length === 0) return [];

    const padding = 22;
    const gap = 66;

    const innerW = gridLayout.width - padding * 2;
    const innerH = gridLayout.height - padding * 2;

    const maxCols = Math.max(...rowCounts);
    const rows = rowCounts.length;

    const cellW = (innerW - gap * (maxCols - 1)) / maxCols;
    const cellH = (innerH - gap * (rows - 1)) / rows;

    // Square cards, capped for portrait kiosk aesthetics
    const size = Math.max(110, Math.min(cellW, cellH, 210));

    const result: Slot[] = [];
    let idx = 0;

    rowCounts.forEach((countInRow, row) => {
      const rowWidth = countInRow * size + gap * (countInRow - 1);
      const startX = gridLayout.x + padding + (innerW - rowWidth) / 2;
      const y = gridLayout.y + padding + row * (size + gap);

      for (let col = 0; col < countInRow; col++) {
        const photo = roundPhotos[idx++];
        if (!photo) break;
        const x = startX + col * (size + gap);
        result.push({ id: photo.id, x, y, size });
      }
    });

    return result;
  }, [gridLayout, roundPhotos, rowCounts]);

  const startPositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    slots.forEach((s) => (pos[s.id] = { x: s.x, y: s.y }));
    return pos;
  }, [slots]);

  const slotSizeById = useMemo(() => {
    const m = new Map<string, number>();
    slots.forEach((s) => m.set(s.id, s.size));
    return m;
  }, [slots]);

  const handleDrop = (
    item: PhotoItem,
    center: { x: number; y: number },
    reset: () => void,
    snapTo: (x: number, y: number) => void,
  ) => {
    if (!mapAreaLayout || status !== "playing") return reset();
    if (placed[item.id]?.placed) return;

    const targetsAbs = LANDMARKS.map((t) => {
      const tx = mapAreaLayout.x + t.x * mapAreaLayout.width;
      const ty = mapAreaLayout.y + t.y * mapAreaLayout.height;
      const r = t.radius * Math.min(mapAreaLayout.width, mapAreaLayout.height);
      return { id: t.id, tx, ty, r };
    });

    let hit: { id: LandmarkId; tx: number; ty: number; r: number } | null =
      null;
    for (const t of targetsAbs) {
      if (distance(center.x, center.y, t.tx, t.ty) <= t.r) {
        hit = t as any;
        break;
      }
    }

    if (!hit) return reset();

    const isCorrect = item.landmarkId === hit.id;

    if (isCorrect) {
      const baseSize = slotSizeById.get(item.id) ?? 160;

      // Center the scaled image on the target
      snapTo(hit.tx - baseSize / 2, hit.ty - baseSize / 2);

      // This triggers the scale animation inside DraggablePhoto
      setPlaced((prev) => ({
        ...prev,
        [item.id]: { placed: true, lockedTo: hit!.id },
      }));
      return;
    }

    // Wrong target → mistake + reset (and scale back to 1)
    setMistakesLeft((m) => {
      const next = m - 1;
      if (next <= 0) setStatus("lose");
      return next;
    });

    reset();
  };

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require("../../assets/map_v2.png")} // change file name to map or map_v2 as needed
        style={styles.bg}
        resizeMode="stretch"
      >
        {/* HEADER INSIDE BG */}
        <View style={styles.header}>
          {/* <Text style={styles.title}>ARMA TU RUTA</Text> */}

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>TIEMPO</Text>
              <Text style={styles.statValue}>{secondsLeft}s</Text>
            </View>

            {/* <View style={styles.statPill}>
              <Text style={styles.statLabel}>INTENTOS</Text>
              <Text style={styles.statValue}>{mistakesLeft}</Text>
            </View> */}
          </View>
        </View>

        {/* MAP AREA: coordinate space for landmarks */}
        <View
          style={styles.mapArea}
          onLayout={(e) => setMapAreaLayout(e.nativeEvent.layout)}
        >
          {mapAreaLayout &&
            LANDMARKS.map((t) => {
              const left = t.x * mapAreaLayout.width;
              const top = t.y * mapAreaLayout.height;
              return (
                <View
                  key={t.id}
                  style={[
                    styles.targetDot,
                    {
                      left: left - 6,
                      top: top - 6,
                      opacity: 0, // set to 1 while calibrating
                    },
                  ]}
                />
              );
            })}

          {DEBUG_PICK_TARGETS && mapAreaLayout && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={(ev) => {
                const x = ev.nativeEvent.locationX / mapAreaLayout.width;
                const y = ev.nativeEvent.locationY / mapAreaLayout.height;
                console.log("TARGET COORD:", {
                  x: Number(x.toFixed(4)),
                  y: Number(y.toFixed(4)),
                });
              }}
            />
          )}
        </View>

        {/* GRID PANEL */}
        <View
          style={styles.gridPanel}
          onLayout={(e) => setGridLayout(e.nativeEvent.layout)}
        >
          {gridLayout &&
            slots.map((s, idx) => (
              <View
                key={s.id}
                style={[
                  styles.gridSlot,
                  {
                    position: "absolute",
                    left: s.x - gridLayout.x,
                    top: s.y - gridLayout.y,
                    width: s.size,
                    height: s.size,
                    //borderColor: BORDER_COLORS[idx % BORDER_COLORS.length],
                  },
                ]}
              />
            ))}
        </View>

        {/* DRAGGABLE PHOTOS */}
        {gridLayout &&
          mapAreaLayout &&
          roundPhotos.map((p) => (
            <DraggablePhoto
              key={p.id}
              item={p}
              size={slotSizeById.get(p.id) ?? 160}
              startPos={startPositions[p.id] ?? { x: 0, y: 0 }}
              disabled={status !== "playing" || placed[p.id]?.placed}
              placed={!!placed[p.id]?.placed} // NEW
              mapScale={0.72} // NEW (tweak: 0.70–0.80)
              onDrop={handleDrop}
            />
          ))}

        {(status === "win" || status === "lose") && (
          <View style={styles.overlay}>
            <Animated.View
              style={[
                styles.overlayCard,
                {
                  opacity: overlayAnim,
                  transform: [
                    {
                      scale: overlayAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.overlayBadge,
                  status === "win" ? styles.badgeWin : styles.badgeLose,
                ]}
              >
                <Text style={styles.overlayBadgeIcon}>
                  {status === "win" ? "✓" : "⏱"}
                </Text>
              </View>

              <Text style={styles.overlayTitle}>
                {status === "win" ? "¡Ganaste!" : "Se acabó el tiempo"}
              </Text>

              <Text style={styles.overlayMessage}>
                {status === "win"
                  ? "Ruta armada correctamente."
                  : "Intenta otra vez y arrastra las fotos al lugar correcto."}
              </Text>

              {/* ✅ Score progress */}
              <View style={styles.scoreRow}>
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillLabel}>Progreso</Text>
                  <Text style={styles.scorePillValue}>
                    {correctPlacedCount}/{requiredToWin}
                  </Text>
                </View>

                {/* Optional: show remaining seconds as 0 / original */}
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillLabel}>Tiempo</Text>
                  <Text style={styles.scorePillValue}>
                    {status === "lose"
                      ? "0s"
                      : `${GAME_RULES.seconds - secondsLeft}s`}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.overlayPill,
                  status === "win" ? styles.pillWin : styles.pillLose,
                ]}
              >
                <Text style={styles.overlayPillText}>
                  {status === "win" ? "¡Excelente!" : "Reiniciando..."}
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Debug button (optional) */}
        <Pressable style={styles.resetBtn} onPress={newRound}>
          <Text style={styles.resetText}>Reiniciar</Text>
        </Pressable>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  bg: { flex: 1, width: "100%", height: "100%" },

  header: {
    paddingTop: 34,
    paddingHorizontal: 22,
    paddingBottom: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 52,
    fontWeight: "900",
    color: "#111",
    textAlign: "center",
    letterSpacing: 1,
  },
  statsRow: {
    marginTop: 700,
    flexDirection: "row",
    gap: 14,
  },
  statPill: {
    minWidth: 170,
    //backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  statLabel: { fontSize: 20, fontWeight: "900", color: "#444" },
  statValue: { fontSize: 50, fontWeight: "900", color: "#111", marginTop: 2 },

  mapArea: {
    flex: 1,
    marginHorizontal: 18,
  },

  gridPanel: {
    height: 900,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.00)", // keep transparent if background already has it
    // If you want a panel like the reference, uncomment:
    // backgroundColor: "rgba(255,255,255,0.80)",
    // borderWidth: 2,
    // borderColor: "rgba(0,0,0,0.08)",
  },

  gridSlot: {
    borderRadius: 18,
    //borderWidth: 6,
    backgroundColor: "rgba(255,255,255,0.0)",
  },

  photo: {
    position: "absolute",
    borderRadius: 18,
    overflow: "hidden",
    elevation: 4,
  },
  photoImg: { width: "100%", height: "100%", resizeMode: "cover" },

  targetDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "red",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  overlayCard: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 26,
    alignItems: "center",
    elevation: 14,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.06)",
  },

  overlayBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 6,
  },

  badgeWin: {
    backgroundColor: "rgba(46, 204, 113, 0.16)",
    borderColor: "rgba(46, 204, 113, 0.45)",
  },

  badgeLose: {
    backgroundColor: "rgba(52, 152, 219, 0.16)",
    borderColor: "rgba(52, 152, 219, 0.45)",
  },

  overlayBadgeIcon: {
    fontSize: 52,
    fontWeight: "900",
    color: "#111",
    marginTop: -2,
  },

  overlayTitle: {
    fontSize: 44,
    fontWeight: "900",
    color: "#111",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  overlayMessage: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(0,0,0,0.65)",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 10,
  },

  scoreRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },

  scorePill: {
    minWidth: 160,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
  },

  scorePillLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "rgba(0,0,0,0.55)",
    letterSpacing: 0.4,
  },

  scorePillValue: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: "900",
    color: "#111",
  },

  overlayPill: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 2,
  },

  pillWin: {
    backgroundColor: "rgba(46, 204, 113, 0.14)",
    borderColor: "rgba(46, 204, 113, 0.35)",
  },

  pillLose: {
    backgroundColor: "rgba(52, 152, 219, 0.14)",
    borderColor: "rgba(52, 152, 219, 0.35)",
  },

  overlayPillText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111",
  },

  resetBtn: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    opacity: 0.2,
  },
  resetText: { color: "white", fontWeight: "700" },
});
