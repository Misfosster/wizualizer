import { useCallback } from "react";
import { TriStateOverridePill, type TriStateValue } from "./TriStateOverridePill";
import type { ConditionAtom } from "@/utils/conditions/types";

/**
 * One leaf row in the override tree: shows the atom's tail label
 * (the property segment, e.g. `up`, `remains`; or the full key when
 * there is no property) and a tri-state pill bound to the current
 * override value.
 *
 * The atom's full canonical key is exposed via title + data attribute
 * so a hover or test selector can disambiguate two atoms whose tail
 * label is identical (e.g. `dot.flame_shock.remains` vs
 * `cooldown.flame_shock.remains` both render as "remains" under
 * different subjects).
 */

export interface AtomOverrideRowProps {
  atom: ConditionAtom;
  value: TriStateValue;
  onChange: (next: TriStateValue) => void;
  disabled?: boolean;
}

export function AtomOverrideRow({
  atom,
  value,
  onChange,
  disabled = false,
}: AtomOverrideRowProps) {
  const handleChange = useCallback(
    (next: TriStateValue) => {
      onChange(next);
    },
    [onChange],
  );

  return (
    <li
      data-condition-override-row={atom.key}
      data-condition-override-overridden={value === undefined ? "false" : "true"}
      className="flex items-center justify-between gap-2 py-0.5 pl-4 pr-1 text-[11px] text-gray-700"
    >
      <span
        className="truncate font-mono text-gray-600"
        title={atom.key}
      >
        {pickRowLabel(atom)}
      </span>
      <TriStateOverridePill
        value={value}
        onChange={handleChange}
        atomKey={atom.key}
        disabled={disabled}
      />
    </li>
  );
}

function pickRowLabel(atom: ConditionAtom): string {
  if (atom.parts.property.length > 0) {
    return atom.parts.property;
  }
  if (atom.parts.subject.length > 0) {
    return atom.parts.subject;
  }
  return atom.parts.namespace;
}
