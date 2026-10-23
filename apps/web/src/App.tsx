import { useEffect, useState } from "react";
import { PencilDefs } from "@snakes-doodle/ui-doodle";
import { GameScreen } from "./game/GameScreen";
import { HomeScreen } from "./game/HomeScreen";
import { OnlineScreen } from "./game/OnlineScreen";
import { codeFromPath } from "./net/online";
import { usePrefersReducedMotion } from "./game/useViewport";
import { unlockAudio } from "./sound";
import { useGame } from "./store";

export function App() {
  const screen = useGame((s) => s.screen);
  const gameNo = useGame((s) => s.gameNo);
  const reduced = usePrefersReducedMotion();
  useEffect(() => useGame.getState().setReducedMotion(reduced), [reduced]);

  // a /join/ABC123 link opens the online page with that code; otherwise a refresh rejoins the
  // room this tab was in. The address goes back to "/" so a later refresh does not join twice.
  const [joinCode] = useState(() => codeFromPath() ?? "");
  useEffect(() => {
    const st = useGame.getState();
    if (joinCode) {
      history.replaceState(null, "", "/");
      st.openOnline();
    } else void st.resumeOnline();
  }, []);

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
      {screen === "home" ? <HomeScreen /> : screen === "online" ? <OnlineScreen initialCode={joinCode} /> : <GameScreen key={gameNo} />}
    </>
  );
}
