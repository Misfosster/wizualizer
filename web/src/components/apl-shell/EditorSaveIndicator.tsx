interface EditorSaveIndicatorProps {
  autoSaveEnabled: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
}

export function EditorSaveIndicator({
  autoSaveEnabled,
  hasUnsavedChanges,
  onSave,
}: EditorSaveIndicatorProps) {
  const label = autoSaveEnabled
    ? "Auto-save enabled"
    : hasUnsavedChanges
      ? "Unsaved changes"
      : "Saved";
  const toneClass = autoSaveEnabled
    ? "border-blue-400/40 bg-blue-500/20 text-blue-100"
    : hasUnsavedChanges
      ? "border-amber-400/40 bg-amber-500/20 text-amber-100"
      : "border-emerald-400/40 bg-emerald-500/20 text-emerald-100";
  const symbol = autoSaveEnabled ? "A" : hasUnsavedChanges ? "!" : "\u2713";
  const className = `absolute right-3 top-3 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold leading-none shadow-sm backdrop-blur ${toneClass}`;

  if (hasUnsavedChanges && !autoSaveEnabled) {
    return (
      <button
        type="button"
        className={`${className} pointer-events-auto transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-300/60`}
        data-testid="apl-save-status"
        title="Save APL"
        aria-label="Save APL"
        onClick={onSave}
      >
        <span aria-hidden="true">{symbol}</span>
        <span className="sr-only">Save APL</span>
      </button>
    );
  }

  return (
    <div
      className={`pointer-events-none ${className}`}
      data-testid="apl-save-status"
      title={label}
      aria-label={label}
    >
      <span aria-hidden="true">{symbol}</span>
    </div>
  );
}
