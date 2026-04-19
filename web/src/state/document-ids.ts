import {
  getActionNodeId,
  getBlockNodeId,
} from "@/utils/apl-parser/node-ids";
import type { AplDocument } from "@/utils/apl-parser/document";

/**
 * Stable-id helpers used by the editor store to keep collapse state in sync
 * with the latest parsed document. Lives separately from `editorStore.ts` to
 * keep the store focused on state orchestration and to honour the
 * single-responsibility split between "where the IDs come from" and "how the
 * store reacts to them changing".
 */

export function getDocumentBlockIds(document: AplDocument): Set<string> {
  const blockIds = new Set<string>();

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    for (const block of profile.blocks) {
      blockIds.add(getBlockNodeId(profileIndex, block.name));
    }
  }

  return blockIds;
}

export function getDocumentActionIds(document: AplDocument): Set<string> {
  const actionIds = new Set<string>();

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    for (const block of profile.blocks) {
      for (let actionIndex = 0; actionIndex < block.actions.length; actionIndex++) {
        actionIds.add(getActionNodeId(profileIndex, block.name, actionIndex));
      }
    }
  }

  return actionIds;
}

export function getBlockActionIds(
  document: AplDocument,
  blockId: string,
): Set<string> {
  const actionIds = new Set<string>();

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    for (const block of profile.blocks) {
      if (getBlockNodeId(profileIndex, block.name) !== blockId) {
        continue;
      }

      for (let actionIndex = 0; actionIndex < block.actions.length; actionIndex++) {
        actionIds.add(getActionNodeId(profileIndex, block.name, actionIndex));
      }

      return actionIds;
    }
  }

  return actionIds;
}

export function pruneCollapsedBlocks(
  document: AplDocument,
  collapsedBlocks: ReadonlySet<string>,
): Set<string> {
  if (collapsedBlocks.size === 0) {
    return new Set<string>();
  }

  const validBlockIds = getDocumentBlockIds(document);
  return new Set(
    Array.from(collapsedBlocks).filter((blockId) => validBlockIds.has(blockId)),
  );
}

export function pruneCollapsedActions(
  document: AplDocument,
  collapsedActions: ReadonlySet<string>,
): Set<string> {
  if (collapsedActions.size === 0) {
    return new Set<string>();
  }

  const validActionIds = getDocumentActionIds(document);
  return new Set(
    Array.from(collapsedActions).filter((actionId) =>
      validActionIds.has(actionId),
    ),
  );
}
