export function Toasts({
  saveError,
  needRefresh,
  onUpdate,
}: {
  saveError: boolean;
  needRefresh: boolean;
  onUpdate: () => void;
}) {
  if (!saveError && !needRefresh) return null;
  return (
    <div className="toasts">
      {saveError && (
        <div className="toast" role="alert">
          This browser can’t save the game. Keep this tab open to continue.
        </div>
      )}
      {needRefresh && (
        <div className="toast" role="status">
          <span>A fresh version is ready.</span>
          <button className="toast-action" onClick={onUpdate}>
            Save &amp; update
          </button>
        </div>
      )}
    </div>
  );
}
