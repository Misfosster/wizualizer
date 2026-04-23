import { useEffect, useRef, useState } from "react";
import type { StoredApl } from "@/state/storage";

const APL_ACTIONS_MENU_WIDTH = 144;
const APL_ACTIONS_MENU_HEIGHT = 116;
const APL_ACTIONS_MENU_GAP = 6;

interface AplLibraryPickerProps {
  savedApls: StoredApl[];
  activeAplId: string;
  hasUnsavedChanges: boolean;
  onSwitchApl: (aplId: string) => void;
  onCreateApl: () => void;
  onDuplicateApl: (aplId: string) => void;
  onRenameApl: (aplId: string, name: string) => void;
  onDeleteApl: (aplId: string) => void;
}

function getAplDisplayName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Untitled APL";
}

function getAplActionsMenuPosition(button: HTMLElement): {
  left: number;
  top: number;
} {
  const rect = button.getBoundingClientRect();
  const viewportPadding = 8;
  const belowTop = rect.bottom + APL_ACTIONS_MENU_GAP;
  const aboveTop = rect.top - APL_ACTIONS_MENU_HEIGHT - APL_ACTIONS_MENU_GAP;
  const hasRoomBelow =
    belowTop + APL_ACTIONS_MENU_HEIGHT <= window.innerHeight - viewportPadding;

  return {
    left: Math.max(
      viewportPadding,
      Math.min(
        rect.right - APL_ACTIONS_MENU_WIDTH,
        window.innerWidth - APL_ACTIONS_MENU_WIDTH - viewportPadding,
      ),
    ),
    top: hasRoomBelow ? belowTop : Math.max(viewportPadding, aboveTop),
  };
}

export function AplLibraryPicker({
  savedApls,
  activeAplId,
  hasUnsavedChanges,
  onSwitchApl,
  onCreateApl,
  onDuplicateApl,
  onRenameApl,
  onDeleteApl,
}: AplLibraryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [renamingAplId, setRenamingAplId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenamingActiveApl, setIsRenamingActiveApl] = useState(false);
  const [openActionsAplId, setOpenActionsAplId] = useState<string | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeApl = savedApls.find((apl) => apl.id === activeAplId);
  const activeAplName = getAplDisplayName(activeApl?.name ?? "");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeMenus(): void {
      setIsOpen(false);
      setRenamingAplId(null);
      setIsRenamingActiveApl(false);
      setOpenActionsAplId(null);
      setActionsMenuPosition(null);
    }

    function handlePointerDown(event: PointerEvent): void {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        closeMenus();
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        closeMenus();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function beginRename(apl: StoredApl): void {
    setRenamingAplId(apl.id);
    setRenameValue(apl.name);
    setIsRenamingActiveApl(false);
    setOpenActionsAplId(null);
    setActionsMenuPosition(null);
  }

  function commitRename(aplId: string): void {
    onRenameApl(aplId, renameValue);
    setRenamingAplId(null);
  }

  function beginActiveAplRename(): void {
    setRenameValue(activeApl?.name ?? "");
    setIsOpen(false);
    setRenamingAplId(null);
    setOpenActionsAplId(null);
    setActionsMenuPosition(null);
    setIsRenamingActiveApl(true);
  }

  function commitActiveAplRename(): void {
    onRenameApl(activeAplId, renameValue);
    setIsRenamingActiveApl(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative min-w-0 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
    >
      <span>Saved APL</span>
      {isRenamingActiveApl ? (
        <div className="mt-1 flex w-full items-center gap-2 rounded-md border border-blue-300 bg-white p-1 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/30 dark:border-blue-400/30 dark:bg-gray-950">
          <input
            autoFocus
            type="text"
            aria-label="Rename current APL"
            value={renameValue}
            maxLength={80}
            onChange={(event) => {
              setRenameValue(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitActiveAplRename();
              }
              if (event.key === "Escape") {
                setIsRenamingActiveApl(false);
              }
            }}
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm font-medium normal-case tracking-normal text-gray-900 focus:outline-none dark:text-white"
          />
          <button
            type="button"
            onClick={() => {
              setIsRenamingActiveApl(false);
            }}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={commitActiveAplRename}
            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100"
          >
            Apply
          </button>
        </div>
      ) : (
        <div className="mt-1 flex w-full overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30 dark:border-white/10 dark:bg-gray-950">
          <button
            type="button"
            aria-label={`Rename ${activeAplName}`}
            title="Rename APL"
            onClick={beginActiveAplRename}
            className="flex shrink-0 items-center justify-center px-2.5 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 focus:outline-none dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            >
              <path d="M12.8 4.2 15.8 7.2" />
              <path d="M5 15 6 11.2 13.7 3.5a2.1 2.1 0 0 1 3 3L9 14.2 5 15Z" />
            </svg>
          </button>
          <button
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="apl-library-menu"
            data-testid="apl-library-button"
            onClick={() => {
              setIsOpen((open) => !open);
              setOpenActionsAplId(null);
              setActionsMenuPosition(null);
            }}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 border-l border-gray-200 px-2.5 py-2 text-left text-sm font-medium normal-case tracking-normal text-gray-900 transition hover:bg-gray-50 focus:outline-none dark:border-white/10 dark:text-white dark:hover:bg-white/10"
          >
            <span className="truncate">{activeAplName}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150 ${
                isOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            >
              <path d="m5 8 5 5 5-5" />
            </svg>
          </button>
        </div>
      )}
      {isOpen ? (
        <div
          id="apl-library-menu"
          role="listbox"
          data-testid="apl-library-menu"
          className="absolute left-0 top-full z-30 mt-2 w-[min(44rem,calc(100vw-4rem))] rounded-lg border border-gray-200 bg-white p-2 text-sm normal-case tracking-normal text-gray-900 shadow-xl dark:border-white/10 dark:bg-gray-950 dark:text-white"
        >
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {savedApls.map((apl) => {
              const displayName = getAplDisplayName(apl.name);
              const isActive = apl.id === activeAplId;
              const isRenaming = apl.id === renamingAplId;

              return (
                <div
                  key={apl.id}
                  role="option"
                  aria-selected={isActive}
                  data-testid="apl-library-row"
                  className="rounded-md border border-transparent p-1.5 hover:border-gray-200 hover:bg-gray-50 dark:hover:border-white/10 dark:hover:bg-white/5"
                >
                  {isRenaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        aria-label={`Rename ${displayName}`}
                        value={renameValue}
                        maxLength={80}
                        onChange={(event) => {
                          setRenameValue(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            commitRename(apl.id);
                          }
                          if (event.key === "Escape") {
                            setRenamingAplId(null);
                          }
                        }}
                        className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-400/30 dark:bg-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingAplId(null);
                        }}
                        className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          commitRename(apl.id);
                        }}
                        className="rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100"
                      >
                        Apply
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSwitchApl(apl.id);
                            setIsOpen(false);
                            setRenamingAplId(null);
                            setOpenActionsAplId(null);
                            setActionsMenuPosition(null);
                          }}
                          className="min-w-0 flex-1 rounded px-2 py-1.5 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-white dark:hover:bg-white/10"
                        >
                          <span className="flex items-center gap-2">
                            <span className="truncate">{displayName}</span>
                            {isActive ? (
                              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-400/15 dark:text-blue-200">
                                Current
                              </span>
                            ) : null}
                            {isActive && hasUnsavedChanges ? (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
                                Unsaved
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            if (openActionsAplId === apl.id) {
                              setOpenActionsAplId(null);
                              setActionsMenuPosition(null);
                              return;
                            }

                            setOpenActionsAplId(apl.id);
                            setActionsMenuPosition(
                              getAplActionsMenuPosition(event.currentTarget),
                            );
                          }}
                          aria-label={`Actions for ${displayName}`}
                          aria-expanded={openActionsAplId === apl.id}
                          className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-white/10"
                        >
                          ...
                        </button>
                      </div>
                      {openActionsAplId === apl.id && actionsMenuPosition ? (
                        <div
                          role="menu"
                          style={{
                            left: actionsMenuPosition.left,
                            top: actionsMenuPosition.top,
                            width: APL_ACTIONS_MENU_WIDTH,
                          }}
                          className="fixed z-50 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-gray-950"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              beginRename(apl);
                            }}
                            className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onDuplicateApl(apl.id);
                              setOpenActionsAplId(null);
                              setRenamingAplId(null);
                              setActionsMenuPosition(null);
                            }}
                            className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-blue-800 hover:bg-blue-50 dark:text-blue-100 dark:hover:bg-blue-400/10"
                          >
                            Create copy
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={savedApls.length <= 1}
                            onClick={() => {
                              onDeleteApl(apl.id);
                              setOpenActionsAplId(null);
                              setRenamingAplId(null);
                              setActionsMenuPosition(null);
                            }}
                            className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent dark:text-red-200 dark:hover:bg-red-400/10 dark:disabled:text-gray-600"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            data-testid="new-apl-option"
            onClick={() => {
              onCreateApl();
              setIsOpen(false);
              setRenamingAplId(null);
              setOpenActionsAplId(null);
              setActionsMenuPosition(null);
            }}
            className="mt-2 w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/15 dark:text-gray-200 dark:hover:border-blue-400/30 dark:hover:bg-blue-400/10 dark:hover:text-blue-100"
          >
            + New APL
          </button>
        </div>
      ) : null}
    </div>
  );
}
