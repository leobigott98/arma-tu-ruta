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
  { id: "l1", x: 0.3392, y: 0.0163, radius: 0.08 }, // los caobos
  { id: "l2", x: 0.2027, y: 0.0013, radius: 0.08 }, // el silencio
  { id: "l3", x: 0.0313, y: 0.2499, radius: 0.10 }, // la paz
  { id: "l4", x: 0.0233, y: 0.4048, radius: 0.10 }, // redoma la india
  { id: "l5", x: 0.2847, y: 0.4634, radius: 0.08 }, // los proceres
  { id: "l6", x: 0.523, y: 0.2549, radius: 0.08 }, // los chaguaramos
  { id: "l7", x: 0.5837, y: 0.3345, radius: 0.08 }, // las mercedes
  { id: "l8", x: 0.6965, y: 0.3253, radius: 0.08 }, // hotel eurobuilding
  { id: "l9", x: 0.8083, y: 0.0607, radius: 0.08 }, // parque del este
  { id: "l10", x: 0.6595, y: 0.0749, radius: 0.08 }, // altamira
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
  seconds: 15,    // time per round
  maxMistakes: Infinity, // no limit
  showCount: 8,      // photos displayed
  requiredCorrect: 5, // win condition
};
