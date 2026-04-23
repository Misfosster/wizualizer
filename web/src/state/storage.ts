import type { TalentRenderMode } from "@/utils/talents/types";
import {
  deserializeConditionOverrides,
  serializeConditionOverrides,
} from "@/utils/conditions/serialize";
import type { ConditionOverrides } from "@/utils/conditions/types";

/**
 * Thin wrappers around `localStorage` so the editor store does not have to
 * sprinkle `typeof window === "undefined"` guards (SSR + the test bootstrap
 * both reach this code before a window exists). Centralising the keys here
 * also keeps the persistence contract auditable in one place.
 */

export const APL_STORAGE_KEY = "logiccraft.aplText";
export const LAST_GOOD_APL_STORAGE_KEY = "logiccraft.lastGoodAplText";
export const APL_LIBRARY_STORAGE_KEY = "logiccraft.aplLibrary.v1";
export const ACTIVE_APL_ID_STORAGE_KEY = "logiccraft.activeAplId";
export const APL_AUTO_SAVE_STORAGE_KEY = "logiccraft.aplAutoSave";
export const TALENT_RENDER_MODE_STORAGE_KEY = "logiccraft.talentRenderMode";
export const TALENT_PANEL_COLLAPSED_STORAGE_KEY =
  "logiccraft.talentPanelCollapsed";
export const CONDITION_OVERRIDES_STORAGE_KEY =
  "logiccraft.conditionOverrides.v1";

export interface StoredApl {
  id: string;
  name: string;
  text: string;
  lastGoodText: string;
  updatedAt: number;
}

export interface StoredAplLibrary {
  apls: StoredApl[];
  activeAplId: string;
}

const VALID_RENDER_MODES: ReadonlySet<TalentRenderMode> = new Set([
  "off",
  "dim",
  "hide",
]);

const DEFAULT_APL_ID = "default";
const DEFAULT_APL_NAME = "Default APL";

export function readStoredText(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(key) ?? "";
}

export function writeStoredText(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStoredApl(value: unknown): StoredApl | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, name, text, lastGoodText, updatedAt } = value;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }

  return {
    id,
    name: typeof name === "string" ? name : DEFAULT_APL_NAME,
    text: typeof text === "string" ? text : "",
    lastGoodText: typeof lastGoodText === "string" ? lastGoodText : "",
    updatedAt: typeof updatedAt === "number" ? updatedAt : Date.now(),
  };
}

function getDefaultStoredApl(): StoredApl {
  return {
    id: DEFAULT_APL_ID,
    name: DEFAULT_APL_NAME,
    text: readStoredText(APL_STORAGE_KEY),
    lastGoodText: readStoredText(LAST_GOOD_APL_STORAGE_KEY),
    updatedAt: Date.now(),
  };
}

export function readStoredAplLibrary(): StoredAplLibrary {
  if (typeof window === "undefined") {
    const apl = getDefaultStoredApl();
    return { apls: [apl], activeAplId: apl.id };
  }

  const raw = window.localStorage.getItem(APL_LIBRARY_STORAGE_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed) && Array.isArray(parsed.apls)) {
        const seen = new Set<string>();
        const apls = parsed.apls.reduce<StoredApl[]>((result, value) => {
          const apl = normalizeStoredApl(value);
          if (!apl || seen.has(apl.id)) {
            return result;
          }
          seen.add(apl.id);
          result.push(apl);
          return result;
        }, []);
        const storedActiveId =
          typeof parsed.activeAplId === "string"
            ? parsed.activeAplId
            : window.localStorage.getItem(ACTIVE_APL_ID_STORAGE_KEY);

        if (apls.length > 0) {
          const activeAplId =
            typeof storedActiveId === "string" &&
            apls.some((apl) => apl.id === storedActiveId)
              ? storedActiveId
              : apls[0].id;
          return { apls, activeAplId };
        }
      }
    } catch {
      // Fall through to the legacy single-APL migration path.
    }
  }

  const apl = getDefaultStoredApl();
  return { apls: [apl], activeAplId: apl.id };
}

export function writeStoredAplLibrary(library: StoredAplLibrary): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    APL_LIBRARY_STORAGE_KEY,
    JSON.stringify({ version: 1, ...library }),
  );
  window.localStorage.setItem(ACTIVE_APL_ID_STORAGE_KEY, library.activeAplId);
}

export function writeStoredActiveAplSnapshot(
  apl: Pick<StoredApl, "text" | "lastGoodText">,
): void {
  writeStoredText(APL_STORAGE_KEY, apl.text);
  writeStoredText(LAST_GOOD_APL_STORAGE_KEY, apl.lastGoodText);
}

export function readStoredAplAutoSave(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(APL_AUTO_SAVE_STORAGE_KEY) === "1";
}

export function writeStoredAplAutoSave(enabled: boolean): void {
  writeStoredText(APL_AUTO_SAVE_STORAGE_KEY, enabled ? "1" : "0");
}

/**
 * Returns the persisted talent render mode, or `"dim"` (the documented
 * default) when nothing is stored or the stored value has been corrupted.
 *
 * Dim is the default because it preserves the visible APL graph - dimming a
 * branch communicates "this exists but cannot fire" without the user losing
 * their place. Hide is opt-in for builders who already trust their talent
 * decode. Off is provided so users can fall back to the pre-feature
 * behaviour at any time.
 */
export function readStoredTalentRenderMode(): TalentRenderMode {
  if (typeof window === "undefined") {
    return "dim";
  }
  const raw = window.localStorage.getItem(TALENT_RENDER_MODE_STORAGE_KEY);
  if (raw && (VALID_RENDER_MODES as ReadonlySet<string>).has(raw)) {
    return raw as TalentRenderMode;
  }
  return "dim";
}

export function writeStoredTalentRenderMode(mode: TalentRenderMode): void {
  writeStoredText(TALENT_RENDER_MODE_STORAGE_KEY, mode);
}

/**
 * Panel collapse state. Defaults to *expanded* because first-run users
 * benefit from seeing the decode / filter status (Nielsen #1: visibility
 * of system status). Returning users who prefer a quieter canvas can
 * collapse the panel and the preference rides along in localStorage.
 */
export function readStoredTalentPanelCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.localStorage.getItem(TALENT_PANEL_COLLAPSED_STORAGE_KEY) === "1"
  );
}

export function writeStoredTalentPanelCollapsed(collapsed: boolean): void {
  writeStoredText(
    TALENT_PANEL_COLLAPSED_STORAGE_KEY,
    collapsed ? "1" : "0",
  );
}

/**
 * Persisted manual condition overrides (the "toggle any condition on/off"
 * panel state). Returns an empty `ConditionOverrides` when nothing is
 * stored or the JSON has drifted from the v1 envelope, so a stale blob
 * can never break preview rendering. Empty values are written as a
 * removal so the key does not linger on disk after a reset.
 */
export function readStoredConditionOverrides(): ConditionOverrides {
  if (typeof window === "undefined") {
    return deserializeConditionOverrides(null);
  }
  return deserializeConditionOverrides(
    window.localStorage.getItem(CONDITION_OVERRIDES_STORAGE_KEY),
  );
}

export function writeStoredConditionOverrides(
  overrides: ConditionOverrides,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const isEmpty =
    Object.keys(overrides.global).length === 0 &&
    Object.keys(overrides.byProfile).length === 0;
  if (isEmpty) {
    window.localStorage.removeItem(CONDITION_OVERRIDES_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(
    CONDITION_OVERRIDES_STORAGE_KEY,
    serializeConditionOverrides(overrides),
  );
}
