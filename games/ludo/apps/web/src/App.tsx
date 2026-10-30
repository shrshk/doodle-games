import { useEffect, useState } from "react";
import { normalizeCode } from "@ludo-doodle/protocol";
import { PencilDefs, startBlinking } from "@doodle-games/ui-doodle";
import { GameScreen } from "./game/GameScreen";
import { HomeScreen } from "./game/HomeScreen";
import { OnlineScreen } from "./game/OnlineScreen";
import { codeFromPath, savedRoomCode } from "./net/online";
import { usePrefersReducedMotion } from "./game/useViewport";
import { unlockAudio } from "./sound";
import { useGame } from "./store";

export function App() {
  const screen = useGame((s) => s.screen);
  const gameNo = useGame((s) => s.gameNo);
  const reduced = usePrefersReducedMotion();
  useEffect(() => useGame.getState().setReducedMotion(reduced), [reduced]);
  useEffect(() => (reduced ? undefined : startBlinking()), [reduced]);

  // A /join/ABC123 link opens the online page with that code; otherwise a refresh rejoins the
  // room this tab was in. A link to the room this tab is already seated in (the host pasting their
  // own share link) takes the seat back instead of joining a second time as someone new.
  // The address goes back to the game's start page so a later refresh does not join twice.
  const [joinCode] = useState(() => {
    const code = codeFromPath();
    return code && normalizeCode(code) !== savedRoomCode() ? code : "";
  });
  useEffect(() => {
    const st = useGame.getState();
    if (codeFromPath()) history.replaceState(null, "", import.meta.env.BASE_URL);
    if (joinCode) st.openOnline();
    else void st.resumeOnline();
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
