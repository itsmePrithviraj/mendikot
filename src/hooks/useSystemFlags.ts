import { useEffect, useState } from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";

/** Live browser facts: connectivity, visibility, full screen, motion preference. */
export function useSystemFlags() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [visible, setVisible] = useState(!document.hidden);
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia(motionQuery).matches,
  );
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    const visibility = () => setVisible(!document.hidden);
    const full = () => setFullscreen(!!document.fullscreenElement);
    const query = matchMedia(motionQuery);
    const motion = () => setSystemReduced(query.matches);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", full);
    query.addEventListener("change", motion);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", full);
      query.removeEventListener("change", motion);
    };
  }, []);
  return { offline, visible, fullscreen, systemReduced };
}

export const canFullscreen = () =>
  typeof document.documentElement.requestFullscreen === "function" &&
  document.fullscreenEnabled !== false;

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    /* Native shells may not support full screen. */
  }
}
