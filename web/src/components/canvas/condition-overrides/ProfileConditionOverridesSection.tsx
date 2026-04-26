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
} from "@/utils/conditions/types";
import { AtomOverrideTree } from "./AtomOverrideTree";

const TALENT_DISABLED_REASON =
  "Talent atoms are import-driven per profile; use global overrides to force talents.";
const MAX_SUGGESTIONS = 12;

interface AtomSuggestion {
  atom: ConditionAtom;
  isCustom: boolean;
}

export interface ProfileConditionOverridesSectionProps {
  profileName: string;
  profileScopeKey: string;
  profileAtoms: readonly ConditionAtom[];
}

export function ProfileConditionOverridesSection({
  profileName,
  profileScopeKey,
  profileAtoms,
}: ProfileConditionOverridesSectionProps) {
  const { conditionOverrides, setConditionOverrides } = useEditorStore(
    useShallow((state) => ({
      conditionOverrides: state.conditionOverrides,
      setConditionOverrides: state.setConditionOverrides,
    })),
  );

  const [draft, setDraft] = useState<string>("");
  const [isPickerOpen, setPickerOpen] = useState<boolean>(false);
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);
  const inputId = useId();
  const listboxId = useId();

  const scope = useMemo(
    () => ({ profile: profileScopeKey }),
    [profileScopeKey],
  );

  const knownAtomsByKey = useMemo(() => {
    const byKey = new Map<string, ConditionAtom>();
    for (const atom of profileAtoms) {
      byKey.set(atom.key, atom);
    }
    return byKey;
  }, [profileAtoms]);

  const profileOverrides = conditionOverrides.byProfile[profileScopeKey] ?? {};
  const displayedKeys = useMemo(() => {
    const keys = new Set<string>(Object.keys(profileOverrides));
    for (const key of selectedKeys) {
      keys.add(key);
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [profileOverrides, selectedKeys]);
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
      getSuggestions(profileAtoms, draft, normalizedDraft, displayedKeySet).slice(
        0,
        MAX_SUGGESTIONS,
      ),
    [displayedKeySet, draft, normalizedDraft, profileAtoms],
  );

  const addKey = useCallback(
    (rawKey: string) => {
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
    },
    [],
  );

  const handleAtomChange = useCallback(
    (atom: ConditionAtom, next: AtomOverrideValue | undefined) => {
      if (atom.isTalent) {
        return;
      }
      const updated =
        next === undefined
          ? clearOverride(conditionOverrides, scope, atom.key)
          : setOverride(conditionOverrides, scope, atom.key, next);
      if (updated !== conditionOverrides) {
        setConditionOverrides(updated);
      }
    },
    [conditionOverrides, scope, setConditionOverrides],
  );

  const handleRemoveAtom = useCallback(
    (atom: ConditionAtom) => {
      setSelectedKeys((prev) => prev.filter((key) => key !== atom.key));
      const updated = clearOverride(conditionOverrides, scope, atom.key);
      if (updated !== conditionOverrides) {
        setConditionOverrides(updated);
      }
    },
    [conditionOverrides, scope, setConditionOverrides],
  );

  const handleReset = useCallback(() => {
    const cleared = clearScope(conditionOverrides, scope);
    setSelectedKeys([]);
    if (cleared !== conditionOverrides) {
      setConditionOverrides(cleared);
    }
  }, [conditionOverrides, scope, setConditionOverrides]);

  const overriddenCount = countOverrides(conditionOverrides, scope);

  return (
    <section
      data-profile-condition-overrides-section={profileName}
      data-profile-scope-key={profileScopeKey}
      aria-label={`Condition overrides for ${profileName || "profile"}`}
      className="mt-1 rounded border border-gray-300 bg-white px-2 py-2"
    >
      <SectionHeader
        profileName={profileName}
        overriddenCount={overriddenCount}
        onReset={handleReset}
      />

      {displayedAtoms.length > 0 ? (
        <div
          data-profile-condition-overrides-active-list=""
          className="mt-2"
        >
          <AtomOverrideTree
            groups={displayedGroups}
            getValue={(atom) =>
              getOverrideValue(conditionOverrides, scope, atom.key)
            }
            onChange={handleAtomChange}
            onRemove={handleRemoveAtom}
            isDisabled={(atom) => atom.isTalent}
            getDisabledReason={(atom) =>
              atom.isTalent ? TALENT_DISABLED_REASON : undefined
            }
          />
        </div>
      ) : (
        <p
          data-profile-condition-overrides-empty=""
          className="mt-2 text-[11px] italic text-gray-500"
        >
          No profile overrides selected.
        </p>
      )}

      <div
        className="relative mt-2 border-t border-gray-200 pt-2"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setPickerOpen(false);
          }
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Add profile condition override
        </label>
        <div className="flex gap-1">
          <div className="relative min-w-0 flex-1">
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
              placeholder="Search or add condition..."
              data-profile-condition-overrides-search=""
              className="nodrag nopan w-full rounded border border-gray-300 bg-white py-1 pl-7 pr-7 text-[11px] text-gray-700 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {draft.length > 0 ? (
              <button
                type="button"
                aria-label="Clear condition input"
                data-profile-condition-overrides-search-clear=""
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
        </div>

        {isPickerOpen ? (
          <div
            id={listboxId}
            role="listbox"
            data-profile-condition-overrides-suggestions=""
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
                {profileAtoms.length === 0
                  ? "No detected conditions."
                  : "No matching detected conditions."}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getSuggestions(
  profileAtoms: readonly ConditionAtom[],
  rawInput: string,
  query: string,
  excludedKeys: ReadonlySet<string>,
): readonly AtomSuggestion[] {
  const detected: AtomSuggestion[] = profileAtoms
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

interface SuggestionOptionProps {
  suggestion: AtomSuggestion;
  onSelect: (key: string) => void;
}

function SuggestionOption({ suggestion, onSelect }: SuggestionOptionProps) {
  const { atom, isCustom } = suggestion;
  return (
    <button
      type="button"
      role="option"
      aria-selected="false"
      data-profile-condition-overrides-suggestion={atom.key}
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
          {isCustom ? "custom" : "locked"}
        </span>
      ) : null}
    </button>
  );
}

interface SectionHeaderProps {
  profileName: string;
  overriddenCount: number;
  onReset: () => void;
}

function SectionHeader({
  profileName,
  overriddenCount,
  onReset,
}: SectionHeaderProps) {
  const hasAny = overriddenCount > 0;
  return (
    <header className="flex items-center justify-between gap-2">
      <h4 className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Profile overrides
      </h4>
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        {hasAny ? (
          <span data-profile-condition-overrides-count="">
            {overriddenCount} active
          </span>
        ) : null}
        <button
          type="button"
          data-profile-condition-overrides-reset={profileName}
          disabled={!hasAny}
          onClick={onReset}
          className={
            hasAny
              ? "rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              : "rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-gray-400"
          }
          aria-label={`Reset condition overrides for ${profileName || "profile"}`}
        >
          Reset
        </button>
      </div>
    </header>
  );
}
