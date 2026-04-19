/**
 * Stable graph node ID helpers.
 *
 * These IDs are derived from source positions (profile index, block name,
 * action index) so they remain identical across collapse toggles, talent
 * render mode switches, and incremental re-parses of the same document.
 *
 * Lives in its own module so both `build-graph.ts` and the filter modules
 * can reference the same format without creating an import cycle.
 */

export function getRootNodeId(profileIndex: number): string {
  return `root__${String(profileIndex)}`;
}

export function getBlockNodeId(profileIndex: number, blockName: string): string {
  return `block__${String(profileIndex)}__${blockName}`;
}

export function getActionNodeId(
  profileIndex: number,
  blockName: string,
  actionIndex: number,
): string {
  return `action__${String(profileIndex)}__${blockName}__${String(actionIndex)}`;
}
