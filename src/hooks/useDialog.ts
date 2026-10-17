import { useEffect, useRef } from "react";

/** Opens a native <dialog> modally while `open` is truthy and returns focus
 * to whatever had it before. */
export function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        lastFocus.current = document.activeElement as HTMLElement | null;
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
      lastFocus.current?.focus();
    }
  }, [open]);
  return ref;
}
