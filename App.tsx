import React, { useState } from "react";
import StartScreen from "./src/screens/StartScreen";
import GameScreen from "./src/screens/GameScreen";

export default function App() {
  const [screen, setScreen] = useState<"start" | "game">("start");

  if (screen === "start") {
    return <StartScreen onStart={() => setScreen("game")} />;
  }

  return <GameScreen onExitToStart={() => setScreen("start")} />;
}

