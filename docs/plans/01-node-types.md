# Node Types

Custom React Flow node components for the graph canvas.

## Overview

5 node types, each with specific purpose and column placement.

| Node Type | Purpose | Column | Collapsible |
|-----------|---------|--------|-------------|
| `RootNode` | Entry point ("Actions") | 0 | No |
| `FolderNode` | Groups like `actions.precombat`, `actions.cds` | 1 | **Yes** |
| `ActionNode` | Individual actions | 1 (root-level) or 2 (in folder) | No |
| `ContainerNode` | Wraps parenthesized groups `(...)` | 3+ | No |
| `ConditionNode` | Leaf condition expressions | 3+ | No |

---

## Column Layout

```
Column 0    Column 1              Column 2         Column 3+
─────────   ──────────────────    ─────────────    ────────────────
Root        Folders               Actions in       Conditions
            + root-level actions  folders          + Containers
```

**Grid metrics**:
- Column width: 320px
- Row height: 120px

---

## RootNode

- **Column**: 0
- **Collapsible**: No
- **Content**: Label ("Actions"), folder count, total action count
- **Handles**: Source (bottom) - edges flow down then branch to column 1 items

```tsx
// Shows: "Actions - 3 folders, 15 actions"
// Handle on bottom avoids edges crossing through column 1 nodes
```

---

## FolderNode

- **Column**: 1
- **Collapsible**: Yes (+/- button in bottom-right)
- **Content**: Display name, action count, action list when expanded
- **Handles**: Target (left), Source (bottom) - signifies "going down a level"
- **Examples**: `actions.precombat` → "Precombat", `actions.cds` → "CDs"

**Note**: No "Main" folder. Actions from `actions+=` are root-level, not wrapped in a folder.

**Bottom handle**: Edges flow down then right to child actions (stacked vertically in column 2). Also semantically indicates descending into the folder.

---

## ActionNode

- **Column**: 1 (root-level) or 2 (inside folder)
- **Collapsible**: No
- **Content**: Action name, "if" badge when condition exists
- **Handles**: Target (left), Source (right)

Root-level actions (from `actions+=`) are siblings of folders at column 1.

---

## ContainerNode

- **Column**: 3+ (inside condition tree)
- **Collapsible**: No
- **Content**: Dashed border container, color by nesting depth
- **Handles**: Target (left), Source (right)

See `02-container-nodes.md` for detailed behavior.

---

## ConditionNode

- **Column**: 3+ (inside condition tree)
- **Collapsible**: No
- **Content**: Expression text (e.g., "buff.flask.up", "targets >= 2")
- **Handles**: Target (left), Source (right)
- **Style**: Orange/amber gradient background, white text

---

## File Structure

```
src/components/nodes/
├── index.ts              # nodeTypes export (memoized)
├── types.ts              # All data interfaces
├── CollapseButton.tsx    # +/- button (FolderNode only)
├── RootNode.tsx
├── FolderNode.tsx
├── ActionNode.tsx
├── ContainerNode.tsx
└── ConditionNode.tsx
```

---

## Memoization

Define `nodeTypes` outside component to avoid recreating on each render:

```typescript
// src/components/nodes/index.ts
export const nodeTypes = {
  root: RootNode,
  folder: FolderNode,
  action: ActionNode,
  container: ContainerNode,
  condition: ConditionNode,
} as const;
```
