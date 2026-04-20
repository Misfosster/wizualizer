import { useCallback, useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";
import { canonicalAtomKey } from "@/utils/conditions/atom-key";
import {
  getAtomDisplayParts,
  getAtomSearchText,
} from "@/utils/conditions/atom-display";
import {
  makeConditionAtomFromInput,
  makeConditionAtomFromKey,
} from "@/utils/conditions/condition-input";
import { extractConditionAtoms } from "@/utils/conditions/extract-atoms";
import { groupAtoms } from "@/utils/conditions/group-atoms";
import {
  clearOverride,
  clearScope,
  countOverrides,
  getOverrideValue,
  setOverride,
} from "@/utils/conditions/mutators";
import type {
  AtomOverrideValue,
  ConditionAtom,
  ConditionOverrides,
} from "@/utils/conditions/types";
import { AtomOverrideTree } from "./AtomOverrideTree";

const MAX_SUGGESTIONS = 12;

interface AtomSuggestion {
  atom: ConditionAtom;
  isCustom: boolean;
}

/**
 * Global condition overrides section for the canvas filter panel.
 *
 * The panel starts empty and lets the user add detected atoms through
 * the bottom picker. That keeps large APLs from turning the filter
 * panel into a wall of every condition in the document.
 */
export function ConditionOverridesSection() {
  const { document, conditionOverrides, setConditionOverrides } = useEditorStore(
    useShallow((state) => ({
      document: state.document,
      conditionOverrides: state.conditionOverrides,
      setConditionOverrides: state.setConditionOverrides,
    })),
  );

  const [draft, setDraft] = useState<string>("");
  const [isPickerOpen, setPickerOpen] = useState<boolean>(false);
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);
  const inputId = useId();
  const listboxId = useId();

  const allAtoms = useMemo<readonly ConditionAtom[]>(() => {
    if (!document) return [];
    return extractConditionAtoms(document).all;
  }, [document]);

  const knownAtomsByKey = useMemo(() => {
    const byKey = new Map<string, ConditionAtom>();
    for (const atom of allAtoms) {
      byKey.set(atom.key, atom);
    }
    return byKey;
  }, [allAtoms]);

  const displayedKeys = useMemo(() => {
    const keys = new Set<string>(Object.keys(conditionOverrides.global));
    for (const key of selectedKeys) {
      keys.add(key);
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [conditionOverrides.global, selectedKeys]);
  const displayedKeySet = useMemo(
    () => new Set(displayedKeys),
    [displayedKeys],
  );
  const displayedAtoms = useMemo(
    () =>
      displayedKeys.flatMap((key) => {
        const atom = knownAtomsByKey.get(key) ?? makeConditionAtomFromKey(key);
        return atom ? [atom] : [];
      }),
    [displayedKeys, knownAtomsByKey],
  );
  const displayedGroups = useMemo(
    () => groupAtoms(displayedAtoms),
    [displayedAtoms],
  );

  const normalizedDraft = canonicalAtomKey(draft);
  const suggestions = useMemo(
    () =>
      getSuggestions(allAtoms, draft, normalizedDraft, displayedKeySet).slice(
        0,
        MAX_SUGGESTIONS,
      ),
    [allAtoms, displayedKeySet, draft, normalizedDraft],
  );

  const addKey = useCallback((rawKey: string) => {
    const atom = makeConditionAtomFromInput(rawKey);
    if (!atom) {
      return;
    }
    const key = atom.key;
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev : [...prev, key].sort(),
    );
    setDraft("");
    setPickerOpen(false);
  }, []);

  const handleAtomChange = useCallback(
    (atom: ConditionAtom, next: AtomOverrideValue | undefined) => {
      const updated =
        next === undefined
          ? clearOverride(conditionOverrides, "global", atom.key)
          : setOverride(conditionOverrides, "global", atom.key, next);
      if (updated !== conditionOverrides) {
        setConditionOverrides(updated);
      }
    },
    [conditionOverrides, setConditionOverrides],
  );

  const handleRemoveAtom = useCallback(
    (atom: ConditionAtom) => {
      setSelectedKeys((prev) => prev.filter((key) => key !== atom.key));
      const updated = clearOverride(conditionOverrides, "global", atom.key);
      if (updated !== conditionOverrides) {
        setConditionOverrides(updated);
      }
    },
    [conditionOverrides, setConditionOverrides],
  );

  const handleClearEverywhere = useCallback(() => {
    let cleared = clearScope(conditionOverrides, "global");
    for (const profileName of Object.keys(cleared.byProfile)) {
      cleared = clearScope(cleared, { profile: profileName });
    }
    setSelectedKeys([]);
    if (cleared !== conditionOverrides) {
      setConditionOverrides(cleared);
    }
  }, [conditionOverrides, setConditionOverrides]);

  const overriddenCount = countOverrides(conditionOverrides, "global");
  const totalOverrideCount = countAllOverrides(conditionOverrides);
  const totalAtoms = allAtoms.length;

  return (
    <section
      data-condition-overrides-section=""
      aria-label="Condition overrides"
      className="mt-3 border-t border-gray-200 pt-2"
    >
      <SectionHeader
        overriddenCount={overriddenCount}
        totalOverrideCount={totalOverrideCount}
        onClearEverywhere={handleClearEverywhere}
      />

      {totalAtoms === 0 ? (
        <p className="mt-1 text-[11px] italic text-gray-500">
          No conditions to override yet - add an action with an{" "}
          <code className="font-mono">if=</code> clause to populate this list.
        </p>
      ) : (
        <>
          {displayedAtoms.length > 0 ? (
            <div
              data-condition-overrides-active-list=""
              className="mt-2 max-h-72 overflow-y-auto pr-1"
            >
              <AtomOverrideTree
                groups={displayedGroups}
                getValue={(atom) =>
                  getOverrideValue(conditionOverrides, "global", atom.key)
                }
                onChange={handleAtomChange}
                onRemove={handleRemoveAtom}
              />
            </div>
          ) : (
            <p
              data-condition-overrides-empty=""
              className="mt-2 text-[11px] italic text-gray-500"
            >
              No global overrides selected.
            </p>
          )}

          <div
            className="relative mt-2"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setPickerOpen(false);
              }
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Add condition override
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
              />
              <input
                id={inputId}
                type="text"
                value={draft}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isPickerOpen}
                aria-controls={listboxId}
                onFocus={() => {
                  setPickerOpen(true);
                }}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setPickerOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && suggestions.length > 0) {
                    event.preventDefault();
                    addKey(suggestions[0].atom.key);
                  }
                }}
                placeholder={`Search or add ${String(totalAtoms)} condition${
                  totalAtoms === 1 ? "" : "s"
                }...`}
                data-condition-overrides-search=""
                className="nodrag nopan w-full rounded border border-gray-300 bg-white py-1 pl-7 pr-7 text-[11px] text-gray-700 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {draft.length > 0 ? (
                <button
                  type="button"
                  aria-label="Clear condition input"
                  data-condition-overrides-search-clear=""
                  onClick={() => {
                    setDraft("");
                    setPickerOpen(true);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {isPickerOpen ? (
              <div
                id={listboxId}
                role="listbox"
                data-condition-overrides-suggestions=""
                className="absolute bottom-full z-20 mb-1 max-h-48 w-full overflow-y-auto rounded border border-gray-300 bg-white py-1 text-[11px] shadow-lg"
              >
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion) => (
                    <SuggestionOption
                      key={`${suggestion.isCustom ? "custom" : "detected"}:${suggestion.atom.key}`}
                      suggestion={suggestion}
                      onSelect={addKey}
                    />
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-gray-500">
                    No matching detected conditions.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

interface SectionHeaderProps {
  overriddenCount: number;
  totalOverrideCount: number;
  onClearEverywhere: () => void;
}

function SectionHeader({
  overriddenCount,
  totalOverrideCount,
  onClearEverywhere,
}: SectionHeaderProps) {
  const hasAny = overriddenCount > 0;
  const hasAnyAnywhere = totalOverrideCount > 0;
  return (
    <header className="flex items-center justify-between gap-1.5">
      <h3 className="whitespace-nowrap text-[11px] font-semibold uppercase text-gray-500">
        Condition overrides
      </h3>
      <div className="flex items-center gap-1 text-[10px] text-gray-500">
        <span
          data-condition-overrides-count=""
          aria-hidden={!hasAny}
          className={hasAny ? "w-[4.5rem] whitespace-nowrap" : "invisible w-[4.5rem] whitespace-nowrap"}
        >
          {overriddenCount} active
        </span>
        <button
          type="button"
          data-condition-overrides-clear-all=""
          disabled={!hasAnyAnywhere}
          onClick={onClearEverywhere}
          className={
            hasAnyAnywhere
              ? "whitespace-nowrap rounded border border-gray-300 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              : "whitespace-nowrap rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-gray-400"
          }
          aria-label="Clear all condition overrides"
        >
          Clear all
        </button>
      </div>
    </header>
  );
}

function getSuggestions(
  atoms: readonly ConditionAtom[],
  rawInput: string,
  query: string,
  excludedKeys: ReadonlySet<string>,
): readonly AtomSuggestion[] {
  const detected: AtomSuggestion[] = atoms
    .filter((atom) => {
      if (excludedKeys.has(atom.key)) {
        return false;
      }
      return query.length === 0 || getAtomSearchText(atom).includes(query);
    })
    .sort((a, b) => {
      if (a.key === query) return -1;
      if (b.key === query) return 1;
      return getAtomDisplayParts(a).displayKey.localeCompare(
        getAtomDisplayParts(b).displayKey,
      );
    })
    .map((atom) => ({ atom, isCustom: false }));

  const customAtom = makeConditionAtomFromInput(rawInput);
  if (
    customAtom &&
    !excludedKeys.has(customAtom.key) &&
    !detected.some((suggestion) => suggestion.atom.key === customAtom.key)
  ) {
    detected.push({ atom: customAtom, isCustom: true });
  }

  return detected.sort((a, b) => {
    if (a.isCustom !== b.isCustom && detected.length > 1) {
      return a.isCustom ? 1 : -1;
    }
    return getAtomDisplayParts(a.atom).displayKey.localeCompare(
      getAtomDisplayParts(b.atom).displayKey,
    );
  });
}

function SuggestionOption({
  suggestion,
  onSelect,
}: {
  suggestion: AtomSuggestion;
  onSelect: (key: string) => void;
}) {
  const { atom, isCustom } = suggestion;
  return (
    <button
      type="button"
      role="option"
      aria-selected="false"
      data-condition-overrides-suggestion={atom.key}
      title={atom.key}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        onSelect(atom.key);
      }}
      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left font-mono text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
    >
      <span className="truncate">
        {isCustom ? "Add " : ""}
        {getAtomDisplayParts(atom).displayKey}
      </span>
      {isCustom || atom.isTalent ? (
        <span className="shrink-0 font-sans text-[10px] text-gray-500">
          {isCustom ? "custom" : "talent"}
        </span>
      ) : null}
    </button>
  );
}

function countAllOverrides(overrides: ConditionOverrides): number {
  let total = Object.keys(overrides.global).length;
  for (const profileOverrides of Object.values(overrides.byProfile)) {
    total += Object.keys(profileOverrides).length;
  }
  return total;
}
