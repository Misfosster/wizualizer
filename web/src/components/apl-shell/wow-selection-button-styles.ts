import type { CSSProperties } from "react";

function mixAccent(accentColor: string, percent: number): string {
  return `color-mix(in srgb, ${accentColor} ${String(percent)}%, transparent)`;
}

function classGradient(accentColor: string, strength: "idle" | "hover"): string {
  if (strength === "hover") {
    return `linear-gradient(135deg, ${mixAccent(accentColor, 42)} 0%, ${mixAccent(accentColor, 22)} 45%, ${mixAccent(accentColor, 10)} 100%)`;
  }
  return `linear-gradient(135deg, ${mixAccent(accentColor, 14)} 0%, ${mixAccent(accentColor, 5)} 100%)`;
}

function specGradient(accentColor: string, strength: "idle" | "hover"): string {
  if (strength === "hover") {
    return `linear-gradient(90deg, ${mixAccent(accentColor, 48)} 0%, ${mixAccent(accentColor, 26)} 38%, ${mixAccent(accentColor, 12)} 100%)`;
  }
  return `linear-gradient(90deg, ${mixAccent(accentColor, 16)} 0%, ${mixAccent(accentColor, 6)} 42%, transparent 100%)`;
}

export type WowSelectionButtonVariant = "class" | "spec";

export function getWowSelectionButtonStyle(
  accentColor: string,
  variant: WowSelectionButtonVariant = "class",
): CSSProperties {
  const gradient = variant === "spec" ? specGradient : classGradient;

  return {
    "--wow-accent": accentColor,
    "--wow-bg": gradient(accentColor, "idle"),
    "--wow-bg-hover": gradient(accentColor, "hover"),
    backgroundImage: "var(--wow-bg)",
    borderColor: mixAccent(accentColor, 32),
  } as CSSProperties;
}

/** Snappy hover; gradient swap is driven by --wow-bg-hover on the element. */
export const WOW_SELECTION_BUTTON_CLASS =
  "bg-transparent transition-[background-image,border-color,box-shadow] duration-75 ease-out hover:[background-image:var(--wow-bg-hover)] hover:border-[var(--wow-accent)] hover:shadow-[0_0_18px_color-mix(in_srgb,var(--wow-accent)_38%,transparent)]";

export const WOW_SELECTION_SPEC_BUTTON_CLASS =
  "border-transparent border-l-[3px] bg-transparent transition-[background-image,border-color,box-shadow] duration-75 ease-out hover:[background-image:var(--wow-bg-hover)] hover:border-l-[var(--wow-accent)] hover:shadow-[0_0_16px_color-mix(in_srgb,var(--wow-accent)_34%,transparent)]";
