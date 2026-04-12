# Container Nodes

Containers represent `GroupExpression` nodes in the AST — explicit parentheses `(...)` in the APL source. They enable graph→APL round-trip fidelity by preserving grouping information.

## Purpose

When APL has explicit parentheses like `(a|b)&c`, the container:
1. Shows the grouping visually with a dashed border
2. Preserves the parentheses through graph round-trips
3. Maps 1:1 with `GroupExpression` in the AST
4. Produces `(...)` when exported back to APL text

Unparenthesized OR-only expressions (e.g. `a|b|c`) do NOT get containers. Pure AND chains also stay bare. AND chains get an AND container only when they are an OR/XOR branch, such as `a&b|c`, where the container clarifies the competing operator group. Root-level parentheses around an OR/XOR stack are visually elided when they would only wrap the whole stack.

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

## Condition Layout Rules

| Expression Pattern | Visual Layout |
|---|---|
| Leaf (`a`) | Single condition node |
| AND chain (`a&b&c`) | Nodes chained horizontally with AND edges, no container |
| OR chain (`a\|b\|c`) | Nodes stacked vertically with OR edges, no container |
| Mixed OR/AND (`a&b\|c`) | AND branch container wrapping `a&b`, then OR edge to `c` |
| GroupExpression (`(a\|b)`) | Container wrapping inner expression, depth increments |
| Root OR group (`(a&b\|c)`) | Outer group container is elided; only the `a&b` AND container remains |

## Example

For: `MAINTENANCE & ((targets >= 2 & mark & (NOT darkest | dance)) | unseen | coup)`

```
                         ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  (blue, depth 0)
                         │                         ┌─ ─ ─ ─ ─ ─ ─┐      │
[MAINTENANCE] ──AND──▶   │  [tgt>=2] ─AND▶ [mark] ─AND▶ │[NOT darkest]│  │
                         │                         │ OR            │      │
                         │                         │[dance]        │      │
                         │                         └─ ─ ─ ─ ─ ─ ─┘      │  (orange, depth 1)
                         │  OR                                            │
                         │  [unseen]                                      │
                         │  OR                                            │
                         │  [coup]                                        │
                         └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

Two containers → two pairs of parentheses on export, matching the original source.

Contrast — `unseen|coup` without parentheses (top-level condition on an action):

```
[Action] ──▶ [unseen]
                 │
                OR
                 ▼
              [coup]
```

No container. Export produces `unseen|coup` — no parentheses.

## AST Mapping

| AST Node | Graph Node |
|----------|------------|
| `GroupExpression` | `ContainerNode` (1:1) |
| `BinaryExpression` (`&`) | AND edges between adjacent terms; AND container only when the AND chain is an OR/XOR branch |
| `BinaryExpression` (`\|`) | OR edges between adjacent branches |
| `ConditionRef` / leaf | `ConditionNode` |

## Graph → Text

When exporting graph to APL text:
- ContainerNode → wrap children in `(...)`
- AND edges → join with `&`
- OR edges → join with `|`
- OR-only and pure AND chains can have no container; AND containers are visual grouping unless they also represent explicit parentheses

## Visual Reference

See `docs/container-node-simplified.svg` for the visual design.
