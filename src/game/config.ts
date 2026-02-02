// src/game/config.ts
export type LandmarkId = "l1" | "l2" | "l3" | "l4" | "l5" | "l6" | "l7" | "l8" | "l9" | "l10";

export type Landmark = {
  id: LandmarkId;
  // normalized coords (0..1) relative to the MAP area
  x: number;
  y: number;
  radius: number; // normalized-ish; we’ll scale with map size
};

export type PhotoItem = {
  id: string;
  source: any; // require(...)
  // if targetId is null => it’s a decoy
  landmarkId: LandmarkId | null;
};

export const LANDMARKS: Landmark[] = [
  // TODO: you will fill these with real positions
  { id: "l1", x: 0.339, y: 0.0393, radius: 0.06 }, // los caobos
  { id: "l2", x: 0.2118, y: 0.0068, radius: 0.06 }, // el silencio
  { id: "l3", x: 0.0446, y: 0.2601, radius: 0.06 }, // la paz
  { id: "l4", x: 0.0342, y: 0.3955, radius: 0.06 }, // redoma la india
  { id: "l5", x: 0.2981, y: 0.4537, radius: 0.06 }, // los proceres
  { id: "l6", x: 0.5223, y: 0.255, radius: 0.06 }, // los chaguaramos
  { id: "l7", x: 0.5821, y: 0.3458, radius: 0.06 }, // las mercedes
  { id: "l8", x: 0.6923, y: 0.3304, radius: 0.06 }, // hotel eurobuilding
  { id: "l9", x: 0.8053, y: 0.0769, radius: 0.06 }, // parque del este
  { id: "l10", x: 0.66, y: 0.0941, radius: 0.06 }, // altamira
];

export const PHOTOS: PhotoItem[] = [
  // Example: 3 correct + 2 decoys shown per round
  { id: "p1", source: require("../../assets/photos/img-001.png"), landmarkId: "l10" },
  { id: "p2", source: require("../../assets/photos/img-002.png"), landmarkId: "l2" },
  { id: "p3", source: require("../../assets/photos/img-003.png"), landmarkId: "l8" },
  { id: "p4", source: require("../../assets/photos/img-004.png"), landmarkId: "l3" },
  { id: "p5", source: require("../../assets/photos/img-005.png"), landmarkId: "l7" },
  { id: "p6", source: require("../../assets/photos/img-006.png"), landmarkId: "l1" },
  { id: "p7", source: require("../../assets/photos/img-007.png"), landmarkId: "l6" },
  { id: "p8", source: require("../../assets/photos/img-008.png"), landmarkId: "l5" },
  { id: "p9", source: require("../../assets/photos/img-009.png"), landmarkId: "l9" },
  { id: "p10", source: require("../../assets/photos/img-010.png"), landmarkId: "l4" },
];

export const GAME_RULES = {
  seconds: 120,    // time per round
  maxMistakes: Infinity, // no limit
  showCount: 8,      // 5 photos displayed
  requiredCorrect: 5 // win condition
};
