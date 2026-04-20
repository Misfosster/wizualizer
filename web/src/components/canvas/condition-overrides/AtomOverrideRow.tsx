import { useCallback, useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { TriStateOverridePill } from "./TriStateOverridePill";
import {
  getAtomRowLabel,
  getBooleanOverrideLabels,
} from "@/utils/conditions/atom-display";
import type {
  AtomOverrideValue,
  ConditionAtom,
} from "@/utils/conditions/types";

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
  value: AtomOverrideValue | undefined;
  onChange: (next: AtomOverrideValue | undefined) => void;
  disabled?: boolean;
  disabledReason?: string;
  label?: string;
  onRemove?: () => void;
}

export function AtomOverrideRow({
  atom,
  value,
  onChange,
  disabled = false,
  disabledReason,
  label,
  onRemove,
}: AtomOverrideRowProps) {
  const isOverridden = value !== undefined;
  const overrideDescriptionId = useId();
  const booleanLabels = getBooleanOverrideLabels(atom);
  const handleChange = useCallback(
    (next: AtomOverrideValue | undefined) => {
      onChange(next);
    },
    [onChange],
  );

  return (
    <li
      data-condition-override-row={atom.key}
      data-condition-override-disabled={disabled ? "true" : "false"}
      data-condition-override-overridden={isOverridden ? "true" : "false"}
      aria-describedby={isOverridden ? overrideDescriptionId : undefined}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-0.5 pl-4 pr-1 text-[11px] text-gray-700"
    >
      {isOverridden ? (
        <span id={overrideDescriptionId} className="sr-only">
          This condition has an active override.
        </span>
      ) : null}
      <span className="flex min-w-0 items-center gap-1">
        <span
          aria-hidden="true"
          className={
            isOverridden
              ? "h-1.5 w-1.5 shrink-0 rounded-full bg-gray-700"
              : "h-1.5 w-1.5 shrink-0 rounded-full bg-transparent"
          }
        />
        <span
          className={
            isOverridden
              ? "truncate font-mono font-semibold text-gray-800"
              : "truncate font-mono text-gray-600"
          }
          title={
            disabledReason
              ? `${atom.key} - ${disabledReason}`
              : atom.key
          }
        >
          {label ?? getAtomRowLabel(atom)}
        </span>
      </span>
      <span className="flex w-[9.75rem] shrink-0 items-center justify-end gap-1">
        {atom.valueKind === "number" ? (
          <NumberOverrideInput
            value={value}
            onChange={handleChange}
            atomKey={atom.key}
            disabled={disabled}
          />
        ) : (
          <TriStateOverridePill
            value={typeof value === "boolean" ? value : undefined}
            onChange={handleChange}
            atomKey={atom.key}
            disabled={disabled}
            trueLabel={booleanLabels.trueLabel}
            falseLabel={booleanLabels.falseLabel}
          />
        )}
        {onRemove ? (
          <button
            type="button"
            aria-label={`Remove ${atom.key} from condition overrides`}
            data-condition-override-remove={atom.key}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="nodrag nopan rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </span>
    </li>
  );
}

interface NumberOverrideInputProps {
  value: AtomOverrideValue | undefined;
  onChange: (next: AtomOverrideValue | undefined) => void;
  atomKey: string;
  disabled: boolean;
}

function NumberOverrideInput({
  value,
  onChange,
  atomKey,
  disabled,
}: NumberOverrideInputProps) {
  const [draft, setDraft] = useState<string>(() => formatNumberValue(value));

  useEffect(() => {
    setDraft(formatNumberValue(value));
  }, [value]);

  return (
    <div
      data-condition-override-number={atomKey}
      aria-label={`Numeric override for ${atomKey}`}
      aria-disabled={disabled || undefined}
      className="nodrag nopan inline-flex items-center rounded-md border border-gray-300 bg-white shadow-sm"
    >
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        aria-label={`Number for ${atomKey}`}
        data-condition-override-number-input={atomKey}
        placeholder="number"
        data-active={typeof value === "number" ? "true" : "false"}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          if (nextDraft.trim().length === 0) {
            onChange(undefined);
            return;
          }
          const nextValue = Number(nextDraft);
          if (Number.isFinite(nextValue)) {
            onChange(nextValue);
          }
        }}
        className={
          disabled
            ? "w-20 rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 outline-none"
            : "w-20 rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
        }
      />
    </div>
  );
}

function formatNumberValue(value: AtomOverrideValue | undefined): string {
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}


