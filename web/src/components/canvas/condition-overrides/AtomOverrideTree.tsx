import { useCallback, useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AtomOverrideRow } from "./AtomOverrideRow";
import type {
  AtomOverrideValue,
  ConditionAtom,
} from "@/utils/conditions/types";
import type { AtomGroup } from "@/utils/conditions/group-atoms";
import { cn } from "@/lib/utils";

/**
 * Renders `AtomGroup`s (namespace → subject → atoms). Namespace groups are
 * collapsible (progressive disclosure). While scrolling the parent list,
 * each namespace title uses `position: sticky` so the current category stays
 * visible at the top of the scrollport until the next section replaces it.
 */

export interface AtomOverrideTreeProps {
  groups: readonly AtomGroup[];
  getValue: (atom: ConditionAtom) => AtomOverrideValue | undefined;
  onChange: (atom: ConditionAtom, next: AtomOverrideValue | undefined) => void;
  onRemove?: (atom: ConditionAtom) => void;
  isDisabled?: (atom: ConditionAtom) => boolean;
  getDisabledReason?: (atom: ConditionAtom) => string | undefined;
}

export function AtomOverrideTree({
  groups,
  getValue,
  onChange,
  onRemove,
  isDisabled,
  getDisabledReason,
}: AtomOverrideTreeProps) {
  const [collapsedNamespaces, setCollapsedNamespaces] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const toggleNamespace = useCallback((namespace: string) => {
    setCollapsedNamespaces((prev) => {
      const next = new Set(prev);
      if (next.has(namespace)) {
        next.delete(namespace);
      } else {
        next.add(namespace);
      }
      return next;
    });
  }, []);

  return (
    <ul
      data-condition-override-tree=""
      className="m-0 flex list-none flex-col gap-1 p-0"
    >
      {groups.map((group) => (
        <NamespaceGroup
          key={group.namespace}
          group={group}
          collapsed={collapsedNamespaces.has(group.namespace)}
          onToggleCollapsed={() => {
            toggleNamespace(group.namespace);
          }}
          getValue={getValue}
          onChange={onChange}
          onRemove={onRemove}
          isDisabled={isDisabled}
          getDisabledReason={getDisabledReason}
        />
      ))}
    </ul>
  );
}

interface NamespaceGroupProps {
  group: AtomGroup;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  getValue: (atom: ConditionAtom) => AtomOverrideValue | undefined;
  onChange: (atom: ConditionAtom, next: AtomOverrideValue | undefined) => void;
  onRemove?: (atom: ConditionAtom) => void;
  isDisabled?: (atom: ConditionAtom) => boolean;
  getDisabledReason?: (atom: ConditionAtom) => string | undefined;
}

function NamespaceGroup({
  group,
  collapsed,
  onToggleCollapsed,
  getValue,
  onChange,
  onRemove,
  isDisabled,
  getDisabledReason,
}: NamespaceGroupProps) {
  const headingId = useId();

  return (
    <li
      data-condition-override-namespace={group.namespace}
      className="m-0 rounded-md border border-gray-200 bg-white/70 shadow-sm"
    >
      <div
        className={cn(
          "sticky top-0 z-[2] rounded-t-md border-b border-gray-200 bg-gray-50/95 px-1 py-0 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-[1px]",
        )}
      >
        <button
          type="button"
          id={headingId}
          aria-expanded={!collapsed}
          aria-controls={`${headingId}-panel`}
          onClick={onToggleCollapsed}
          className={cn(
            "nodrag nopan flex w-full min-h-[31px] items-center gap-1.5 rounded px-1 text-left",
            "text-[10px] font-semibold uppercase tracking-wide text-gray-600",
            "hover:bg-gray-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          )}
        >
          <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-gray-500" aria-hidden>
            {collapsed ? (
              <ChevronRight className="h-3 w-3" strokeWidth={2.25} />
            ) : (
              <ChevronDown className="h-3 w-3" strokeWidth={2.25} />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{group.label}</span>
        </button>
      </div>
      <div
        id={`${headingId}-panel`}
        role="region"
        aria-labelledby={headingId}
        hidden={collapsed}
        className="rounded-b-md"
      >
        <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0 px-1 pb-1">
          {group.subjects.map((subgroup) => (
            <li
              key={`${group.namespace}.${subgroup.subject}`}
              data-condition-override-subject={subgroup.subject || "(none)"}
              className="m-0 rounded bg-gray-50/80"
            >
              {subgroup.subject ? (
                <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                  {subgroup.subject}
                </div>
              ) : null}
              <ul className="m-0 flex list-none flex-col gap-1 p-1">
                {subgroup.atoms.map((atom) => (
                  <AtomOverrideRow
                    key={atom.key}
                    atom={atom}
                    value={getValue(atom)}
                    disabled={isDisabled ? isDisabled(atom) : false}
                    disabledReason={getDisabledReason?.(atom)}
                    onRemove={
                      onRemove
                        ? () => {
                            onRemove(atom);
                          }
                        : undefined
                    }
                    onChange={(next) => {
                      onChange(atom, next);
                    }}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
