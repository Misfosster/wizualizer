# Container Nodes

Containers wrap parenthesized expressions `(...)` in the APL, providing visual grouping for complex conditions.

## Purpose

When APL has explicit parentheses like `(a|b)&c`, the container:
1. Shows the grouping visually with a dashed border
2. Preserves the parentheses through graph round-trips
3. Maps 1:1 with `GroupExpression` in the AST

## Color by Depth

Nesting depth determines border/background color:

| Depth | Color | Border Class | Background |
|-------|-------|--------------|------------|
| 0 | Blue | `border-blue-400` | `bg-blue-50/50` |
| 1 | Orange | `border-orange-400` | `bg-orange-50/50` |
| 2 | Purple | `border-purple-400` | `bg-purple-50/50` |
| 3 | Teal | `border-teal-400` | `bg-teal-50/50` |
| 4+ | Cycles | Repeats from blue | Repeats |

## Visual Style

- **Border**: 2px dashed, color by depth
- **Background**: Semi-transparent matching border color
- **Border radius**: 12px (rounded-xl)
- **Min size**: 320px width, 100px height
- **No collapse button**: Containers are not collapsible

## Example

For: `MAINTENANCE & ((targets >= 2 & mark & (NOT darkest | dance)) | unseen | coup)`

```
Container (blue, depth 0)
├── Cond: targets>=2 ─AND→ Cond: mark ─AND→ Container (orange, depth 1)
│                                          ├── Cond: NOT darkest
│                                          │     OR
│                                          └── Cond: dance
│ OR
├── Cond: unseen_blade
│ OR
└── Cond: coup_de_grace
```

## AST Mapping

| AST Node | Graph Node |
|----------|------------|
| `GroupExpression` | `ContainerNode` |
| `BinaryExpression` (& or \|) | Edges (AND/OR) |
| `ConditionRef` | `ConditionNode` |

## Graph → Text

When exporting graph to APL text:
- ContainerNode → wrap children in `(...)`
- Preserves explicit parentheses from original APL

## Visual Reference

See `docs/container-node-simplified.svg` for the visual design.
