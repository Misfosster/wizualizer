import {
  useCallback,
  useId,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";

/**
 * Three-way tri-state toggle: `Default` (no opinion - undefined),
 * `On` (true), `Off` (false). Used by the condition override panel
 * to drive the value of one atom in one scope.
 *
 * Accessibility:
 *   - `radiogroup` semantics so screen readers and keyboard users
 *     perceive the three buttons as a single mutually-exclusive
 *     choice (Nielsen #4 - platform conventions).
 *   - The active button uses both colour and weight for the contrast
 *     ratio (visibility of system status; WCAG 1.4.1).
 *   - Each button carries a verbose `aria-label` so a screen reader
 *     announces both the state and the atom it controls.
 *
 * Visual:
 *   - Compact horizontal pill so it fits on the right of an atom row
 *     without wrapping; matches the existing TalentModeSegmentedControl
 *     visual language so the panel feels cohesive.
 *   - `Default` is the rest state and uses the lightest treatment so
 *     glance scans pick out actively-overridden rows immediately.
 */

export type TriStateValue = boolean | undefined;

export interface TriStateOverridePillProps {
  value: TriStateValue;
  onChange: (next: TriStateValue) => void;
  /** Used to build descriptive labels (e.g. "buff.ascendance.up"). */
  atomKey: string;
  /** Optional disabled state - per-profile UI uses this for talent atoms. */
  disabled?: boolean;
  trueLabel?: string;
  falseLabel?: string;
  /** Forwarded to the wrapper for test / e2e selection. */
  testId?: string;
}

interface PillOption {
  value: TriStateValue;
  label: string;
  description: (atomKey: string) => string;
}

export function TriStateOverridePill({
  value,
  onChange,
  atomKey,
  disabled = false,
  trueLabel = "On",
  falseLabel = "Off",
  testId,
}: TriStateOverridePillProps) {
  const groupId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const options = useMemo(
    () => buildOptions(trueLabel, falseLabel),
    [falseLabel, trueLabel],
  );
  const handleSelect = useCallback(
    (next: TriStateValue) => {
      if (disabled || next === value) {
        return;
      }
      onChange(next);
    },
    [disabled, onChange, value],
  );
  const handleKeyboardMove = useCallback(
    (nextIndex: number) => {
      const option = options[nextIndex];
      handleSelect(option.value);
      window.requestAnimationFrame(() => {
        buttonRefs.current[nextIndex]?.focus();
      });
    },
    [handleSelect, options],
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      const currentIndex = Math.max(
        0,
        options.findIndex((option) => option.value === value),
      );
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          handleKeyboardMove((currentIndex + 1) % options.length);
          return;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          handleKeyboardMove(
            (currentIndex - 1 + options.length) % options.length,
          );
          return;
        case "Home":
          event.preventDefault();
          handleKeyboardMove(0);
          return;
        case "End":
          event.preventDefault();
          handleKeyboardMove(options.length - 1);
          return;
      }
    },
    [disabled, handleKeyboardMove, options, value],
  );

  return (
    <div
      role="radiogroup"
      aria-label={`Override for ${atomKey}`}
      aria-disabled={disabled || undefined}
      id={groupId}
      data-condition-override-pill={atomKey}
      data-testid={testId}
      className="nodrag nopan grid w-[7.75rem] grid-cols-[3.25rem_2.25rem_2.25rem] rounded-md border border-gray-300 bg-white p-0.5 shadow-sm"
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.label}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.description(atomKey)}
            disabled={disabled}
            tabIndex={isActive ? 0 : -1}
            data-condition-override-value={
              option.value === undefined
                ? "default"
                : option.value
                  ? "true"
                  : "false"
            }
            data-active={isActive ? "true" : "false"}
            className={buttonClassName(isActive, disabled)}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (event.button !== 0) return;
              event.preventDefault();
              handleSelect(option.value);
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (event.detail > 0) return;
              handleSelect(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function buildOptions(
  trueLabel: string,
  falseLabel: string,
): readonly PillOption[] {
  return [
    {
      value: undefined,
      label: "Default",
      description: (key) => `Use the default value for ${key}`,
    },
    {
      value: true,
      label: trueLabel,
      description: (key) => `Force ${key} to ${trueLabel.toLowerCase()}`,
    },
    {
      value: false,
      label: falseLabel,
      description: (key) => `Force ${key} to ${falseLabel.toLowerCase()}`,
    },
  ];
}

function buttonClassName(isActive: boolean, disabled: boolean): string {
  if (disabled) {
    return "h-5 w-full rounded px-0 text-center text-[10px] font-semibold text-gray-400 cursor-not-allowed";
  }
  if (isActive) {
    return "h-5 w-full rounded bg-gray-800 px-0 text-center text-[10px] font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500";
  }
  return "h-5 w-full rounded px-0 text-center text-[10px] font-semibold text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500";
}
