import { AplLibraryPicker } from "@components/apl-shell/AplLibraryPicker";
import type { StoredApl } from "@/state/storage";

interface AplToolbarProps {
  savedApls: StoredApl[];
  activeAplId: string;
  autoSaveEnabled: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onAutoSaveChange: (enabled: boolean) => void;
  onSwitchApl: (aplId: string) => void;
  onCreateApl: () => void;
  onDuplicateApl: (aplId: string) => void;
  onRenameApl: (aplId: string, name: string) => void;
  onDeleteApl: (aplId: string) => void;
}

export function AplToolbar({
  savedApls,
  activeAplId,
  autoSaveEnabled,
  hasUnsavedChanges,
  onSave,
  onAutoSaveChange,
  onSwitchApl,
  onCreateApl,
  onDuplicateApl,
  onRenameApl,
  onDeleteApl,
}: AplToolbarProps) {
  return (
    <div className="rounded-lg rounded-bl-none border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-gray-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-xl">
          <AplLibraryPicker
            savedApls={savedApls}
            activeAplId={activeAplId}
            hasUnsavedChanges={hasUnsavedChanges}
            onSwitchApl={onSwitchApl}
            onCreateApl={onCreateApl}
            onDuplicateApl={onDuplicateApl}
            onRenameApl={onRenameApl}
            onDeleteApl={onDeleteApl}
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!hasUnsavedChanges}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-white disabled:text-gray-400 disabled:hover:bg-white dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100 dark:hover:bg-blue-400/20 dark:disabled:border-white/10 dark:disabled:bg-gray-950 dark:disabled:text-gray-600"
          >
            Save
          </button>
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-white/10">
            <input
              type="checkbox"
              aria-label="Auto-save APL"
              checked={autoSaveEnabled}
              onChange={(event) => {
                onAutoSaveChange(event.target.checked);
              }}
              className="h-4 w-4 accent-blue-600"
            />
            Auto-save
          </label>
        </div>
      </div>
    </div>
  );
}
