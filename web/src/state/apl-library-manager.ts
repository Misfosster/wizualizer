import {
  type StoredApl,
  writeStoredActiveAplSnapshot,
  writeStoredAplLibrary,
} from "./storage";

export interface AplDraftState {
  savedApls: readonly StoredApl[];
  activeAplId: string;
  draftAplName: string;
  aplText: string;
  lastGoodText: string;
}

export function createAplId(): string {
  if (typeof crypto !== "undefined") {
    return crypto.randomUUID();
  }
  return `apl-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function getAplDisplayName(apl: Pick<StoredApl, "name">): string {
  const trimmed = apl.name.trim();
  return trimmed.length > 0 ? trimmed : "Untitled APL";
}

export function getUniqueAplName(
  baseName: string,
  apls: readonly StoredApl[],
): string {
  const used = new Set(apls.map((apl) => getAplDisplayName(apl).toLowerCase()));
  if (!used.has(baseName.toLowerCase())) {
    return baseName;
  }
  for (let index = 2; ; index += 1) {
    const candidate = `${baseName} ${String(index)}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
}

export function updateStoredApl(
  apls: readonly StoredApl[],
  aplId: string,
  updates: Partial<Omit<StoredApl, "id">>,
): StoredApl[] {
  return apls.map((apl) =>
    apl.id === aplId ? { ...apl, ...updates, updatedAt: Date.now() } : apl,
  );
}

export function getActiveStoredApl(
  state: Pick<AplDraftState, "savedApls" | "activeAplId">,
): StoredApl | undefined {
  return state.savedApls.find((apl) => apl.id === state.activeAplId);
}

export function hasUnsavedAplChanges(state: AplDraftState): boolean {
  const activeApl = getActiveStoredApl(state);
  if (!activeApl) {
    return true;
  }
  return (
    activeApl.name !== state.draftAplName ||
    activeApl.text !== state.aplText ||
    activeApl.lastGoodText !== state.lastGoodText
  );
}

export function persistAplLibrary(
  apls: StoredApl[],
  activeAplId: string,
): void {
  writeStoredAplLibrary({ apls, activeAplId });
  const activeApl = apls.find((apl) => apl.id === activeAplId);
  if (activeApl) {
    writeStoredActiveAplSnapshot(activeApl);
  }
}

export function saveDraftToLibrary(state: AplDraftState): StoredApl[] {
  return updateStoredApl(state.savedApls, state.activeAplId, {
    name: state.draftAplName,
    text: state.aplText,
    lastGoodText: state.lastGoodText,
  });
}
