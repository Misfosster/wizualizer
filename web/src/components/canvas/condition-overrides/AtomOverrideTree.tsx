import { AtomOverrideRow } from "./AtomOverrideRow";
import type {
  AtomOverrideValue,
  ConditionAtom,
} from "@/utils/conditions/types";
import type { AtomGroup } from "@/utils/conditions/group-atoms";

/**
 * Render a list of `AtomGroup`s (namespace -> subject -> atoms) as a
 * compact, fully-expanded tree. We intentionally do *not* support
 * per-group collapse here; the panel-level collapse already covers
 * "I don't want to see any of this", and the search box covers
 * "narrow this down". Adding another level of disclosure would just
 * be more clicks for the same outcome (Hick's Law tradeoff).
 *
 * The disabled callback decides per-atom whether the pill is locked.
 * It defaults to false (everything editable); the per-profile UI in
 * E3 plugs in `(atom) => atom.isTalent` so talent atoms stay read-
 * only at the per-profile scope while staying editable globally.
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
  return (
    <ul
      data-condition-override-tree=""
      className="m-0 flex list-none flex-col gap-1 p-0"
    >
      {groups.map((group) => (
        <NamespaceGroup
          key={group.namespace}
          group={group}
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
  getValue: (atom: ConditionAtom) => AtomOverrideValue | undefined;
  onChange: (atom: ConditionAtom, next: AtomOverrideValue | undefined) => void;
  onRemove?: (atom: ConditionAtom) => void;
  isDisabled?: (atom: ConditionAtom) => boolean;
  getDisabledReason?: (atom: ConditionAtom) => string | undefined;
}

function NamespaceGroup({
  group,
  getValue,
  onChange,
  onRemove,
  isDisabled,
  getDisabledReason,
}: NamespaceGroupProps) {
  return (
    <li
      data-condition-override-namespace={group.namespace}
      className="m-0 rounded border border-gray-200 bg-white/70 px-1 py-1"
    >
      <div className="select-none px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {group.label}
      </div>
      <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
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
    </li>
  );
}
