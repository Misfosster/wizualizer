import { AtomOverrideRow } from "./AtomOverrideRow";
import type { TriStateValue } from "./TriStateOverridePill";
import type { ConditionAtom } from "@/utils/conditions/types";
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
  getValue: (atom: ConditionAtom) => TriStateValue;
  onChange: (atom: ConditionAtom, next: TriStateValue) => void;
  isDisabled?: (atom: ConditionAtom) => boolean;
}

export function AtomOverrideTree({
  groups,
  getValue,
  onChange,
  isDisabled,
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
          isDisabled={isDisabled}
        />
      ))}
    </ul>
  );
}

interface NamespaceGroupProps {
  group: AtomGroup;
  getValue: (atom: ConditionAtom) => TriStateValue;
  onChange: (atom: ConditionAtom, next: TriStateValue) => void;
  isDisabled?: (atom: ConditionAtom) => boolean;
}

function NamespaceGroup({
  group,
  getValue,
  onChange,
  isDisabled,
}: NamespaceGroupProps) {
  return (
    <li data-condition-override-namespace={group.namespace} className="m-0">
      <div className="select-none px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {group.namespace}
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {group.subjects.map((subgroup) => (
          <li
            key={`${group.namespace}.${subgroup.subject}`}
            data-condition-override-subject={subgroup.subject || "(none)"}
            className="m-0"
          >
            {subgroup.subject ? (
              <div className="px-2 pt-1 text-[11px] font-medium text-gray-700">
                {subgroup.subject}
              </div>
            ) : null}
            <ul className="m-0 flex list-none flex-col p-0">
              {subgroup.atoms.map((atom) => (
                <AtomOverrideRow
                  key={atom.key}
                  atom={atom}
                  value={getValue(atom)}
                  disabled={isDisabled ? isDisabled(atom) : false}
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
