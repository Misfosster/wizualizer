# Collapse/Expand Behavior

Blocks are the only collapsible structural nodes in the current graph.

## Summary

- `block` nodes can collapse and expand their child action list
- collapsing a block hides its action nodes and all descendant condition/value nodes
- other node kinds are not directly collapsible, but they disappear when their parent block is collapsed

## Current Behavior

When a block is expanded:

- the block shows its name, action count, and a collapse button
- action nodes render beneath the block as normal
- edges from the block to its action children render as normal

When a block is collapsed:

- the block still shows its name and total action count
- child action nodes are omitted from the graph
- edges to those child nodes are omitted from the graph
- the graph compacts vertically because the hidden child rows are not reserved

## State Management

Collapse state lives in the Zustand editor store as a `Set<string>` keyed by block node id:

```ts
interface EditorState {
  collapsedBlocks: Set<string>;
  toggleBlockCollapse: (blockId: string) => void;
}
```

The graph builder receives that set and marks each block node with `isCollapsed`, then skips child action graph construction for collapsed blocks.

## Block Toggle UI

- position: right side of the block node, centered vertically
- icon: `-` when expanded, `+` when collapsed
- action count remains visible while collapsed
- the button uses the block name in its accessible label, for example `Collapse block actions` and `Expand block actions`

## Out Of Scope

- global "collapse all" / "expand all" controls
- persisting collapse state across reloads
- collapsing anything other than blocks
