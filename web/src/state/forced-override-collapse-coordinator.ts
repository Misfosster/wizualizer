import type { AplDocument } from "@/utils/apl-parser/document";
import {
  type ComputeImpossibleSetOptions,
  getActionIdsForcedOffByOverride,
} from "@/utils/filters/compute-impossible-set";
import { getDocumentActionIds } from "./document-ids";

export interface ForcedOverrideCollapseMergeInput {
  collapsedActions: ReadonlySet<string>;
  lastForcedOffActionIds: ReadonlySet<string>;
  userExpandedForcedOffActionIds: ReadonlySet<string>;
}

/**
 * Keeps action collapse state aligned with overrides: actions that are "forced off
 * by override" stay collapsed unless the user explicitly expands them; when an
 * override no longer forces an action off, that collapse is cleared.
 */
export class ForcedOverrideCollapseCoordinator {
  static merge(
    document: AplDocument,
    input: ForcedOverrideCollapseMergeInput,
    options: ComputeImpossibleSetOptions,
  ): {
    collapsedActions: Set<string>;
    lastForcedOffActionIds: Set<string>;
    userExpandedForcedOffActionIds: Set<string>;
  } {
    const nextForced = getActionIdsForcedOffByOverride(document, options);
    const validIds = getDocumentActionIds(document);

    const collapsed = new Set(
      [...input.collapsedActions].filter((id) => validIds.has(id)),
    );
    const userExpanded = new Set<string>();
    for (const id of input.userExpandedForcedOffActionIds) {
      if (validIds.has(id)) {
        userExpanded.add(id);
      }
    }

    for (const id of input.lastForcedOffActionIds) {
      if (!validIds.has(id)) {
        continue;
      }
      if (!nextForced.has(id)) {
        collapsed.delete(id);
      }
    }

    for (const id of [...userExpanded]) {
      if (!nextForced.has(id)) {
        userExpanded.delete(id);
      }
    }

    for (const id of nextForced) {
      if (!userExpanded.has(id)) {
        collapsed.add(id);
      }
    }

    return {
      collapsedActions: collapsed,
      lastForcedOffActionIds: new Set(nextForced),
      userExpandedForcedOffActionIds: userExpanded,
    };
  }
}
