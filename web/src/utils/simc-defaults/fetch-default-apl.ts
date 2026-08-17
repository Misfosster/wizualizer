import manifest from "@/data/simc-defaults/manifest.json" with { type: "json" };
import { SimcDefaultFetchError } from "./types";

const PROFILE_CACHE = new Map<string, string>();

function getRawProfileUrl(file: string): string {
  const encodedFile = file
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://raw.githubusercontent.com/${manifest.source}/${manifest.ref}/${manifest.directory}/${encodedFile}`;
}

export async function fetchSimcDefaultProfile(
  file: string,
): Promise<{ text: string }> {
  const cached = PROFILE_CACHE.get(file);
  if (cached !== undefined) {
    return { text: cached };
  }

  let response: Response;
  try {
    response = await fetch(getRawProfileUrl(file));
  } catch {
    throw new SimcDefaultFetchError(
      "offline",
      "Couldn't reach SimulationCraft. Check your connection and try again.",
    );
  }

  if (response.status === 404) {
    throw new SimcDefaultFetchError(
      "not_found",
      "That default profile is no longer available on GitHub.",
    );
  }

  if (!response.ok) {
    throw new SimcDefaultFetchError(
      "http_error",
      `SimulationCraft returned ${String(response.status)}.`,
    );
  }

  const text = await response.text();
  PROFILE_CACHE.set(file, text);
  return { text };
}

/** Clears the in-memory profile cache (for tests). */
export function clearSimcDefaultProfileCache(): void {
  PROFILE_CACHE.clear();
}
