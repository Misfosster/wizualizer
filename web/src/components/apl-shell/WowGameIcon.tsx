import { useState } from "react";
import { getWowIconUrl } from "@/data/wow-class-visuals";

interface WowGameIconProps {
  iconFile: string;
  accentColor: string;
  size?: "sm" | "md";
}

const SIZE_CLASSES = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
} as const;

export function WowGameIcon({
  iconFile,
  accentColor,
  size = "md",
}: WowGameIconProps) {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  if (failed) {
    return (
      <span
        aria-hidden="true"
        className={`${sizeClass} shrink-0 rounded border border-white/10`}
        style={{ backgroundColor: accentColor }}
      />
    );
  }

  return (
    <img
      src={getWowIconUrl(iconFile)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        setFailed(true);
      }}
      className={`${sizeClass} shrink-0 rounded border border-black/20 object-cover`}
    />
  );
}
