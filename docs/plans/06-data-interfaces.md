# Data Interfaces

TypeScript interfaces for node data structures.

## Node Data Types

```typescript
// src/components/nodes/types.ts

// ─────────────────────────────────────────────────────────────────
// Condition: Leaf node (orange gradient boxes)
// ─────────────────────────────────────────────────────────────────
export interface ConditionNodeData {
  id: string;
  expression: string;  // "buff.foo.up", "targets >= 2", "NOT darkest_night.up"
}

// ─────────────────────────────────────────────────────────────────
// Container: Wraps parenthesized groups (...)
// Color determined by depth: 0=blue, 1=orange, 2=purple, etc.
// NOT collapsible - just a visual grouping
// ─────────────────────────────────────────────────────────────────
export interface ContainerNodeData {
  id: string;
  depth: number;  // 0 = blue, 1 = orange, 2 = purple...
  children: (ConditionNodeData | ContainerNodeData)[];
}

// ─────────────────────────────────────────────────────────────────
// Action: Individual action with optional condition tree
// NOT collapsible
// ─────────────────────────────────────────────────────────────────
export interface ActionNodeData {
  id: string;              // "action__actions__0" (composite ID)
  name: string;            // "flask", "rupture"
  rawText?: string;        // Full action text for inspector
  condition?: ContainerNodeData | ConditionNodeData;
}

// ─────────────────────────────────────────────────────────────────
// Folder: Contains list of actions - ONLY collapsible node type
// e.g. "actions.precombat", "actions.cds"
// ─────────────────────────────────────────────────────────────────
export interface FolderNodeData {
  id: string;
  name: string;            // "actions.precombat", "actions.cds"
  displayName: string;     // "Precombat", "CDs"
  actions: ActionNodeData[];
  isCollapsed: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Root: Entry point containing folders AND root-level actions
// Root-level actions come from "actions+=" (no folder suffix)
// ─────────────────────────────────────────────────────────────────
export interface RootNodeData {
  label: string;                    // "Actions"
  folders: FolderNodeData[];        // actions.precombat, actions.cds, etc.
  rootActions: ActionNodeData[];    // actions+= (siblings of folders)
}
```

## Composite ID Pattern

Action IDs encode hierarchy for O(1) lookup:

```typescript
const actionId = `action__${folderName}__${index}`;
// e.g., "action__actions.precombat__0"

function parseActionId(actionId: string) {
  const [, folderName, indexStr] = actionId.split('__');
  return { folderName, actionIndex: Number(indexStr) };
}
```

For root-level actions:
```typescript
const actionId = `action__root__${index}`;
// e.g., "action__root__0"
```

## Type Guards

```typescript
export function isConditionNode(data: unknown): data is ConditionNodeData {
  return typeof data === 'object' && data !== null && 'expression' in data;
}

export function isContainerNode(data: unknown): data is ContainerNodeData {
  return typeof data === 'object' && data !== null && 'depth' in data;
}

export function isFolderNode(data: unknown): data is FolderNodeData {
  return typeof data === 'object' && data !== null && 'actions' in data && 'displayName' in data;
}
```

## React Flow Node Types

```typescript
import type { Node } from '@xyflow/react';

export type RootNode = Node<RootNodeData, 'root'>;
export type FolderNode = Node<FolderNodeData, 'folder'>;
export type ActionNode = Node<ActionNodeData, 'action'>;
export type ContainerNode = Node<ContainerNodeData, 'container'>;
export type ConditionNode = Node<ConditionNodeData, 'condition'>;

export type AplNode = RootNode | FolderNode | ActionNode | ContainerNode | ConditionNode;
```
