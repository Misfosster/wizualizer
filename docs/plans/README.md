# Plans

Design documentation for upcoming features, organized by concern.

## Start Here

The active handoff for the next milestone is
[11-graph-editing.md](11-graph-editing.md). It links the accepted visual direction,
the mutation-boundary spike, implementation sequence, code entry points, and test
matrix.

Earlier plans remain useful references but some predate the current implementation.
Verify them against `docs/05-GRAPH-FEATURE.md` and the code before treating old
type names or module boundaries as current.

## Plans

| File | Topic |
|------|-------|
| [01-node-types.md](01-node-types.md) | Custom React Flow node components |
| [02-container-nodes.md](02-container-nodes.md) | Container behavior for parenthesized groups |
| [03-explorer-tree.md](03-explorer-tree.md) | File-system-like tree view |
| [04-edge-types.md](04-edge-types.md) | AND, OR, and standard edge styling |
| [05-collapse-expand.md](05-collapse-expand.md) | Folder collapse/expand behavior |
| [06-data-interfaces.md](06-data-interfaces.md) | TypeScript interfaces for node data |
| [07-undo-redo.md](07-undo-redo.md) | History tracking with zundo |
| [08-ui-stack.md](08-ui-stack.md) | shadcn/ui, react-arborist, component structure |
| [09-variable-jump-to.md](09-variable-jump-to.md) | Variable reference navigation in the graph |
| [10-talent-aware-rendering.md](10-talent-aware-rendering.md) | Decode `talents=` and dim/hide impossible actions |
| [11-graph-editing.md](11-graph-editing.md) | Current graph-editing implementation handoff |

## Accepted Visual Reference

- `docs/spikes/assets/001-condition-builder.png` - accepted handle-driven condition
  builder and connection styling

## Historical Visual References

- `docs/container-node-simplified.svg` - Container node layout design
- `docs/container-node-vision.svg` - Original vision (more complex)

## Related Docs

- `docs/00-OVERVIEW.md` - Project overview
- `docs/01-ARCHITECTURE-SUMMARY.md` - Overall architecture
- `docs/02-DESIGN-PATTERNS.md` - Code patterns
- `docs/04-ROADMAP.md` - Project roadmap
