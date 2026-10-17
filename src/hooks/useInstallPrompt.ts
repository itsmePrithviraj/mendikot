import { useEffect, useState } from "react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/** Captures the browser install prompt. `install()` returns false when the
 * prompt is unavailable so the caller can show manual instructions. */
export function useInstallPrompt(onInstalled: () => void) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const capture = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const installed = () => {
      setEvent(null);
      onInstalled();
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
    // onInstalled is a stable setter wrapper from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function install(): Promise<boolean> {
    if (!event) return false;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
    return true;
  }
  return install;
}
