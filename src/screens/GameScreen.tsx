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
import { PHOTOS, GAME_RULES, LANDMARKS, PhotoItem, LandmarkId } from "../game/config";

type PlacedMap = Record<string, { placed: boolean; lockedTo: LandmarkId | null }>;

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function distance(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Small draggable component (absolute positioned)
 */
function DraggablePhoto(props: {
  item: PhotoItem;
  size: number;
  startPos: { x: number; y: number };
  disabled: boolean;
  onDrop: (item: PhotoItem, center: { x: number; y: number }, reset: () => void, snapTo: (x: number, y: number) => void) => void;
}) {
  const { item, size, startPos, disabled, onDrop } = props;

  const pan = useRef(new Animated.ValueXY({ x: startPos.x, y: startPos.y })).current;

  useEffect(() => {
    // If startPos changes (new round), reset it
    pan.setValue({ x: startPos.x, y: startPos.y });
  }, [startPos.x, startPos.y]);

  const reset = () => {
    Animated.spring(pan, {
      toValue: { x: startPos.x, y: startPos.y },
      useNativeDriver: false,
      friction: 6,
    }).start();
  };

  const snapTo = (x: number, y: number) => {
    Animated.spring(pan, {
      toValue: { x, y },
      useNativeDriver: false,
      friction: 7,
    }).start();
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: () => {
          // “Pick up”
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
    [disabled, item.id, size, startPos.x, startPos.y]
  );

  return (
    <Animated.View style={[styles.photo, { width: size, height: size, transform: pan.getTranslateTransform() }]} {...responder.panHandlers}>
      <Image source={item.source} style={styles.photoImg} />
    </Animated.View>
  );
}

export default function GameScreen(props: { onExitToStart: () => void }) {
  const { onExitToStart } = props;

  const [mapLayout, setMapLayout] = useState<LayoutRectangle | null>(null);
  const [trayLayout, setTrayLayout] = useState<LayoutRectangle | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(GAME_RULES.seconds);
  const [mistakesLeft, setMistakesLeft] = useState(GAME_RULES.maxMistakes);

  const [roundPhotos, setRoundPhotos] = useState<PhotoItem[]>([]);
  const [placed, setPlaced] = useState<PlacedMap>({});
  const [status, setStatus] = useState<"playing" | "win" | "lose">("playing");

  const [requiredToWin, setRequiredToWin] = useState(GAME_RULES.requiredCorrect);

  // Debug helper: tap map to log normalized coordinates
  const DEBUG_PICK_TARGETS = true;

  const photoSize = 140; // tweak for your kiosk resolution

  const startPositions = useMemo(() => {
    if (!trayLayout) return {};
    // Arrange photos in a row/grid inside the tray area
    const cols = 5;
    const gap = 18;
    const usableW = trayLayout.width;
    const cellW = usableW / cols;

    const baseY = trayLayout.y + (trayLayout.height - photoSize) / 2;

    const pos: Record<string, { x: number; y: number }> = {};
    roundPhotos.forEach((p, i) => {
      const col = i % cols;
      const x = trayLayout.x + col * cellW + (cellW - photoSize) / 2;
      pos[p.id] = { x: x + clamp(gap, 0, 999), y: baseY };
    });
    return pos;
  }, [trayLayout, roundPhotos]);

  const correctPlacedCount = useMemo(() => {
    return roundPhotos.reduce((acc, p) => {
      if (!p.landmarkId) return acc;
      if (placed[p.id]?.placed) return acc + 1;
      return acc;
    }, 0);
  }, [roundPhotos, placed]);

  // Start a fresh round
  const newRound = () => {
    const picked = shuffle(PHOTOS).slice(0, GAME_RULES.showCount);
    setRoundPhotos(picked);
    setRequiredToWin(picked.length);

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

    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== "playing") return;
    if (secondsLeft <= 0) setStatus("lose");
  }, [secondsLeft, status]);

  useEffect(() => {
    if (status !== "playing") return;

    if (correctPlacedCount >= requiredToWin) {
      setStatus("win");
    }
  }, [correctPlacedCount, status]);

  useEffect(() => {
    if (status === "win" || status === "lose") {
      const timeout = setTimeout(() => {
        // Back to start screen OR just restart round — your choice.
        onExitToStart();
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  const handleDrop = (
    item: PhotoItem,
    center: { x: number; y: number },
    reset: () => void,
    snapTo: (x: number, y: number) => void
  ) => {
    if (!mapLayout || status !== "playing") return reset();
    if (placed[item.id]?.placed) return;

    // If decoy: always reset (optionally count mistake if dropped near a target)
    const targetsAbs = LANDMARKS.map((t) => {
      const tx = mapLayout.x + t.x * mapLayout.width;
      const ty = mapLayout.y + t.y * mapLayout.height;
      const r = t.radius * Math.min(mapLayout.width, mapLayout.height);
      return { id: t.id, tx, ty, r };
    });

    // Find nearest target if within radius
    let hit: { id: LandmarkId; tx: number; ty: number; r: number } | null = null;
    for (const t of targetsAbs) {
      if (distance(center.x, center.y, t.tx, t.ty) <= t.r) {
        hit = t as any;
        break;
      }
    }

    if (!hit) {
      // dropped somewhere else: no penalty, just reset
      return reset();
    }

    // Dropped on a target
    const isCorrect = item.landmarkId === hit.id;

    if (isCorrect) {
      // snap top-left so image centers on target
      snapTo(hit.tx - photoSize / 2, hit.ty - photoSize / 2);
      setPlaced((prev) => ({
        ...prev,
        [item.id]: { placed: true, lockedTo: hit!.id },
      }));
      return;
    }

    // Wrong target (or decoy on a target): mistake + reset
    setMistakesLeft((m) => {
      const next = m - 1;
      if (next <= 0) {
        setStatus("lose");
      }
      return next;
    });
    reset();
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.topText}>Tiempo: {secondsLeft}s</Text>
        <Text style={styles.topText}>Intentos: {mistakesLeft}</Text>
      </View>

      <View
        style={styles.mapWrap}
        onLayout={(e) => setMapLayout(e.nativeEvent.layout)}
      >
        <ImageBackground
          source={require("../../assets/map.png")}
          style={styles.mapBg}
          resizeMode="contain"
        >
          {/* Optional: show target circles for debugging */}
          {mapLayout &&
            LANDMARKS.map((t) => {
              const left = t.x * mapLayout.width;
              const top = t.y * mapLayout.height;
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

          {DEBUG_PICK_TARGETS && mapLayout && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={(ev) => {
                const x = ev.nativeEvent.locationX / mapLayout.width;
                const y = ev.nativeEvent.locationY / mapLayout.height;
                console.log("TARGET COORD:", { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
              }}
            />
          )}
        </ImageBackground>
      </View>

      <View
        style={styles.tray}
        onLayout={(e) => setTrayLayout(e.nativeEvent.layout)}
      >
        <Text style={styles.trayTitle}>Arrastra las fotos</Text>
      </View>

      {/* Draggables must be rendered on top, absolute */}
      {trayLayout &&
        mapLayout &&
        roundPhotos.map((p) => (
          <DraggablePhoto
            key={p.id}
            item={p}
            size={photoSize}
            startPos={startPositions[p.id] ?? { x: 0, y: 0 }}
            disabled={status !== "playing" || placed[p.id]?.placed}
            onDrop={handleDrop}
          />
        ))}

      {(status === "win" || status === "lose") && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            {status === "win" ? "¡Ganaste!" : "Perdiste"}
          </Text>
          <Text style={styles.overlaySub}>
            {status === "win" ? "Ruta armada correctamente." : "Intenta otra vez."}
          </Text>
        </View>
      )}

      {/* In-kiosk you might not want this, but useful while testing */}
      <Pressable style={styles.resetBtn} onPress={newRound}>
        <Text style={styles.resetText}>Reiniciar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topText: { fontSize: 22, fontWeight: "700" },

  mapWrap: { 
    flex: 1, 
    paddingHorizontal: 18 
  },
  mapBg: { flex: 1, justifyContent: "center", alignItems: "center", width: '100%', height: '100%'},

  tray: {
    height: 220,
    borderTopWidth: 2,
    borderColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  trayTitle: { fontSize: 18, color: "#666" },

  photo: {
    position: "absolute",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 6,
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
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayText: { fontSize: 54, color: "white", fontWeight: "900" },
  overlaySub: { fontSize: 20, color: "white", marginTop: 10 },

  resetBtn: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    opacity: 0.2, // keep subtle
  },
  resetText: { color: "white", fontWeight: "700" },
});
