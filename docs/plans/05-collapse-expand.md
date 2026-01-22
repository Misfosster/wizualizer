# Collapse/Expand Behavior

Only FolderNodes are collapsible. All other node types remain always visible.

## What's Collapsible

| Node Type | Collapsible |
|-----------|-------------|
| RootNode | No |
| **FolderNode** | **Yes** |
| ActionNode | No |
| ContainerNode | No |
| ConditionNode | No |

## Folder Collapse Button

- **Position**: Bottom-right corner of FolderNode
- **Size**: 24x24px (meets 44px touch target with padding)
- **Icon**: `+` when collapsed, `-` when expanded
- **Behavior**: Click toggles collapse state

```tsx
<CollapseButton
  isCollapsed={data.isCollapsed}
  onToggle={() => toggleFolderCollapse(id)}
/>
```

## Collapsed State

When a folder is collapsed:
- Shows folder name + action count badge
- Hides the action list
- Child action nodes in the graph are hidden
- Edges to hidden children are hidden

## Expanded State

When a folder is expanded:
- Shows folder name + action count
- Shows full list of action names
- Child action nodes visible in graph
- All edges visible

## Global Controls

Toolbar buttons above the canvas (using shadcn/ui Button):

- **"Collapse All Folders"**: Collapses every folder
- **"Expand All Folders"**: Expands every folder

```tsx
import { Button } from '@/components/ui/button';

<CollapseToolbar>
  <Button variant="outline" size="sm" onClick={collapseAllFolders}>
    Collapse All Folders
  </Button>
  <Button variant="outline" size="sm" onClick={expandAllFolders}>
    Expand All Folders
  </Button>
</CollapseToolbar>
```

## State Management

Zustand store tracks collapsed folders:

```typescript
interface EditorState {
  collapsedFolders: Set<string>;
  toggleFolderCollapse: (folderId: string) => void;
  collapseAllFolders: () => void;
  expandAllFolders: () => void;
}
```

## Why Only Folders?

- **Folders** group related actions - collapsing reduces visual noise
- **Actions** are the primary work unit - should stay visible
- **Containers** show condition structure - collapsing would hide important logic
- **Conditions** are leaf nodes - nothing to collapse

## Keyboard Shortcuts (Future)

Potential shortcuts:
- `Cmd/Ctrl + [`: Collapse selected folder
- `Cmd/Ctrl + ]`: Expand selected folder
- `Cmd/Ctrl + Shift + [`: Collapse all folders
- `Cmd/Ctrl + Shift + ]`: Expand all folders
