import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useDialog } from "../../hooks/useDialog";

/** Native modal <dialog>: a bottom sheet on phones, centred card on wide
 * screens. Escape, backdrop tap and the close button all dismiss it. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useDialog(open);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="sheet-title"
    >
      {open && (
        <div className="sheet-inner">
          <header className="sheet-head">
            <h2 id="sheet-title">{title}</h2>
            <button className="icon-btn sheet-close" aria-label="Close" onClick={onClose}>
              <X strokeWidth={1.75} />
            </button>
          </header>
          <div className="sheet-body">{children}</div>
        </div>
      )}
    </dialog>
  );
}
