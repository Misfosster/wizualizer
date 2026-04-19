import { useCallback, useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";
import { extractConditionAtoms } from "@/utils/conditions/extract-atoms";
import {
  filterAtomsBySearch,
  groupAtoms,
} from "@/utils/conditions/group-atoms";
import {
  clearOverride,
  clearScope,
  countOverrides,
  getOverrideValue,
  setOverride,
} from "@/utils/conditions/mutators";
import type { ConditionAtom } from "@/utils/conditions/types";
import { AtomOverrideTree } from "./AtomOverrideTree";
import type { TriStateValue } from "./TriStateOverridePill";

/**
 * Global condition overrides section for the canvas filter panel.
 *
 * UX intent:
 *   - Lives directly under the existing render-mode + per-profile
 *     status block so the controls that affect graph filtering are
 *     visually grouped (Nielsen #2 - match between system and the
 *     real world: "all the things that change which actions render").
 *   - A single text input is the universal escape hatch for big
 *     atom lists; we collect every atom referenced anywhere in the
 *     document, so a busy APL can easily expose 30-40 entries.
 *   - Tri-state pills give Default / On / Off control without making
 *     the user reason about what "unselect" means - matches the
 *     wording from the data model.
 *
 * Scope: this section only controls the *global* layer. The per-
 * profile layer reuses the same tree + pill primitives in E3 with a
 * different value/disabled wiring; nothing in this file is per-
 * profile-specific.
 */
export function ConditionOverridesSection() {
  const { document, conditionOverrides, setConditionOverrides } = useEditorStore(
    useShallow((state) => ({
      document: state.document,
      conditionOverrides: state.conditionOverrides,
      setConditionOverrides: state.setConditionOverrides,
    })),
  );

  const [search, setSearch] = useState<string>("");
  const searchInputId = useId();

  const allAtoms = useMemo<readonly ConditionAtom[]>(() => {
    if (!document) return [];
    return extractConditionAtoms(document).all;
  }, [document]);

  const visibleAtoms = useMemo(
    () => filterAtomsBySearch(allAtoms, search),
    [allAtoms, search],
  );
  const groups = useMemo(() => groupAtoms(visibleAtoms), [visibleAtoms]);

  const handleAtomChange = useCallback(
    (atom: ConditionAtom, next: TriStateValue) => {
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

  const handleResetAll = useCallback(() => {
    const cleared = clearScope(conditionOverrides, "global");
    if (cleared !== conditionOverrides) {
      setConditionOverrides(cleared);
    }
  }, [conditionOverrides, setConditionOverrides]);

  const overriddenCount = countOverrides(conditionOverrides, "global");
  const totalAtoms = allAtoms.length;

  if (totalAtoms === 0) {
    return (
      <section
        data-condition-overrides-section=""
        aria-label="Condition overrides"
        className="mt-3 border-t border-gray-200 pt-2"
      >
        <SectionHeader overriddenCount={0} onReset={handleResetAll} />
        <p className="mt-1 text-[11px] italic text-gray-500">
          No conditions to override yet - add an action with an
          {" "}
          <code className="font-mono">if=</code> clause to populate this list.
        </p>
      </section>
    );
  }

  return (
    <section
      data-condition-overrides-section=""
      aria-label="Condition overrides"
      className="mt-3 border-t border-gray-200 pt-2"
    >
      <SectionHeader
        overriddenCount={overriddenCount}
        onReset={handleResetAll}
      />

      <SearchInput
        id={searchInputId}
        value={search}
        onChange={setSearch}
        totalAtoms={totalAtoms}
        visibleCount={visibleAtoms.length}
      />

      {visibleAtoms.length === 0 ? (
        <p
          data-condition-overrides-empty=""
          className="mt-2 text-[11px] italic text-gray-500"
        >
          No conditions match &ldquo;{search}&rdquo;.
        </p>
      ) : (
        <div className="mt-1 max-h-72 overflow-y-auto pr-1">
          <AtomOverrideTree
            groups={groups}
            getValue={(atom) => getOverrideValue(conditionOverrides, "global", atom.key)}
            onChange={handleAtomChange}
          />
        </div>
      )}
    </section>
  );
}

interface SectionHeaderProps {
  overriddenCount: number;
  onReset: () => void;
}

function SectionHeader({ overriddenCount, onReset }: SectionHeaderProps) {
  const hasAny = overriddenCount > 0;
  return (
    <header className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Condition overrides
      </h3>
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        {hasAny ? (
          <span data-condition-overrides-count="">
            {overriddenCount} active
          </span>
        ) : null}
        <button
          type="button"
          data-condition-overrides-reset=""
          disabled={!hasAny}
          onClick={onReset}
          className={
            hasAny
              ? "rounded border border-gray-300 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              : "rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-gray-400"
          }
          aria-label="Reset all global condition overrides"
        >
          Reset
        </button>
      </div>
    </header>
  );
}

interface SearchInputProps {
  id: string;
  value: string;
  onChange: (next: string) => void;
  totalAtoms: number;
  visibleCount: number;
}

function SearchInput({
  id,
  value,
  onChange,
  totalAtoms,
  visibleCount,
}: SearchInputProps) {
  const isFiltering = value.trim().length > 0;
  return (
    <div className="mt-2">
      <label htmlFor={id} className="sr-only">
        Search conditions
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={`Search ${String(totalAtoms)} condition${totalAtoms === 1 ? "" : "s"}...`}
          data-condition-overrides-search=""
          className="nodrag nopan w-full rounded border border-gray-300 bg-white py-1 pl-7 pr-7 text-[11px] text-gray-700 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {isFiltering ? (
          <button
            type="button"
            aria-label="Clear search"
            data-condition-overrides-search-clear=""
            onClick={() => {
              onChange("");
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {isFiltering ? (
        <p
          data-condition-overrides-search-summary=""
          className="mt-0.5 text-[10px] text-gray-500"
        >
          Showing {String(visibleCount)} of {String(totalAtoms)}
        </p>
      ) : null}
    </div>
  );
}
