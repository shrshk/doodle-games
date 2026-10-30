import { useEffect } from "react";
import { PencilDefs, startBlinking } from "@doodle-games/ui-doodle";
import { GameScreen } from "./game/GameScreen";
import { HomeScreen } from "./game/HomeScreen";
import { usePrefersReducedMotion } from "./game/useViewport";
import { unlockAudio } from "./sound";
import { useGame } from "./store";

export function App() {
  const screen = useGame((s) => s.screen);
  const gameNo = useGame((s) => s.gameNo);
  const reduced = usePrefersReducedMotion();
  useEffect(() => useGame.getState().setReducedMotion(reduced), [reduced]);
  useEffect(() => (reduced ? undefined : startBlinking()), [reduced]);

  // audio may only start after a user gesture; M toggles sound anywhere outside text fields
  useEffect(() => {
    const unlock = () => unlockAudio();
    const onKey = (e: KeyboardEvent) => {
      unlockAudio();
      const typing = (e.target as HTMLElement | null)?.tagName === "INPUT";
      if (!typing && (e.key === "m" || e.key === "M")) useGame.getState().toggleMute();
    };
    // iOS only counts touchend / click as a gesture that may start audio; pointerdown covers the rest
    const gestures = ["pointerdown", "touchend", "click"] as const;
    gestures.forEach((g) => window.addEventListener(g, unlock, { passive: true }));
    window.addEventListener("keydown", onKey);
    // coming back to the app: wake the audio engine iOS suspended
    const onVisible = () => document.visibilityState === "visible" && unlockAudio();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      gestures.forEach((g) => window.removeEventListener(g, unlock));
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <>
      <PencilDefs />
      <div className="paper" aria-hidden="true" />
      {screen === "home" ? <HomeScreen /> : <GameScreen key={gameNo} />}
    </>
  );
}
