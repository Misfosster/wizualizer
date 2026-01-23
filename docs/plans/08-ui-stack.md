# UI Stack

Component libraries and styling approach for Logiccraft.

## Stack Overview

| Layer | Choice | Purpose |
|-------|--------|---------|
| **Styling** | Tailwind CSS v4 | Utility-first CSS |
| **UI Components** | shadcn/ui | Pre-styled, accessible components |
| **Explorer Tree** | react-arborist | File tree navigation |
| **Graph Canvas** | React Flow | Node-based graph editor |
| **State** | Zustand | Lightweight state management |

## shadcn/ui

Pre-styled components built on Radix UI primitives, copied into your codebase.

### Why shadcn/ui over raw Radix?

- **Pre-styled**: Beautiful defaults with Tailwind
- **Accessible**: Radix accessibility under the hood
- **Owned code**: Components live in your repo, full control
- **Consistent**: All components follow same design system
- **Popular**: Large community, well-maintained

### Setup

```bash
npx shadcn@latest init
```

This creates:
- `components.json` - shadcn configuration
- `src/components/ui/` - where components are copied
- `src/lib/utils.ts` - the `cn()` utility (clsx + tailwind-merge)

### Adding Components

```bash
npx shadcn@latest add button
npx shadcn@latest add tabs
npx shadcn@latest add dialog
npx shadcn@latest add tooltip
npx shadcn@latest add collapsible
```

Components are copied to `src/components/ui/` - you own them.

### Components Needed

| Component | Use Case |
|-----------|----------|
| `button` | Toolbar buttons, collapse/expand |
| `tabs` | Write/Preview tabs |
| `collapsible` | Folder expand/collapse in explorer |
| `dialog` | Import/export modals |
| `tooltip` | Node hover info |
| `separator` | Visual dividers |

## react-arborist

Purpose-built tree component for the explorer panel.

### Why react-arborist?

- File tree UI (exactly our use case)
- Keyboard navigation built-in
- Drag-and-drop support
- Virtualization for performance
- Customizable node rendering

### Integration

```tsx
import { Tree } from 'react-arborist';

<Tree
  data={explorerData}
  onSelect={handleSelect}
  rowHeight={28}
  indent={16}
>
  {Node}  // Custom node renderer
</Tree>
```

## Custom Components

Built from scratch for this project:

| Component | Location | Purpose |
|-----------|----------|---------|
| `RootNode` | `components/nodes/` | Graph root |
| `FolderNode` | `components/nodes/` | Collapsible folder |
| `ActionNode` | `components/nodes/` | APL action |
| `ContainerNode` | `components/nodes/` | Parentheses grouping |
| `ConditionNode` | `components/nodes/` | Condition expression |
| `CollapseButton` | `components/nodes/` | +/- toggle |
| `CollapseToolbar` | `components/` | Global collapse controls |

## File Structure

```
src/
├── components/
│   ├── ui/                 # shadcn/ui components (auto-generated)
│   │   ├── button.tsx
│   │   ├── tabs.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── nodes/              # Custom React Flow nodes
│   │   ├── RootNode.tsx
│   │   ├── FolderNode.tsx
│   │   └── ...
│   ├── explorer/           # Explorer tree components
│   │   └── ExplorerTree.tsx
│   ├── CollapseToolbar.tsx
│   └── Canvas.tsx
├── lib/
│   └── utils.ts            # cn() utility from shadcn
└── ...
```

## Styling Approach

1. **shadcn components**: Use as-is or customize in `components/ui/`
2. **Custom components**: Tailwind classes + `cn()` utility
3. **React Flow nodes**: Tailwind classes matching shadcn theme
4. **Dark mode**: Handled by Tailwind's dark: variant

## Migration from Raw Radix

Current codebase has `@radix-ui/react-tabs`. After shadcn setup:

1. Run `npx shadcn@latest add tabs`
2. Update imports: `@radix-ui/react-tabs` → `@/components/ui/tabs`
3. Remove direct Radix dependency (shadcn handles it)
