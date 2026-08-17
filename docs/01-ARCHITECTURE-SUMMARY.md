# LogicCraft - Architecture Summary

Last updated: 2026-08-17

## Current Data Flow

APL text is the canonical persisted state. Parsed documents and graph elements are
derived:

```text
APL text
  -> editorStore.applyAplText()
  -> parseDocument()
  -> AplDocument
  -> buildGraph()
  -> React Flow nodes and edges
  -> Canvas
```

On invalid text, the store retains the last-good document and graph while exposing
the current parse diagnostics. Derived graph nodes are never a second source of
truth.

The current Explorer already performs narrow edits by replacing or reordering
source lines and sending the resulting text through `applyAplText()`. The React
Flow canvas itself remains read-only.

## Planned Graph-Edit Flow

The graph-editing milestone will add a guarded operation boundary without changing
the canonical-state rule:

```text
canvas gesture
  -> GraphEditIntent
  -> pure document/text operation
  -> reparse and validate
  -> applyAplText()
  -> graph rebuild
  -> selection recovery
```

The exact mutation and identity contract is the subject of
[SPK-002](spikes/002-graph-mutation-boundary.md). There is no implemented
`AplDocumentManager` or full-document printer today; do not build canvas editing
around an assumed service that does not exist.

## Architectural Rules

### Canonical text and recovery

- `aplText` is the canonical user document.
- `lastGoodText` and the last-good parsed document protect against invalid input.
- A graph operation must produce text that reparses before it reaches the store.
- Failed, stale, inherited, or unsupported operations leave canonical and
  last-good state unchanged.

### Derived graph

- `buildGraph()` and the deterministic layout own React Flow nodes and edges.
- Canvas components emit intents; they do not mutate derived nodes or the parsed
  document in place.
- Node ids and source line numbers are deterministic locators, not permanent
  identity across reorder/insert/delete operations.
- A committed graph operation must return enough information to recover selection
  after rebuilding.

### History

- One committed graph gesture must create one undo/redo boundary.
- Draft UI state is not canonical and must not enter history.
- Text and graph edits must share one observable document history rather than
  diverging into separate stores.

### Condition editing

The accepted interaction is documented in
[SPK-001](spikes/001-node-visual-language.md):

- right condition handle: hover/focus reveals an in-handle `+` for AND;
- bottom condition handle: hover/focus reveals an in-handle `+` for OR;
- activation creates a provisional connection and draft condition;
- commit emits one graph-edit intent; cancel emits none;
- deletion normalizes away any operator/container that became redundant;
- logical containers are derived scope, not persisted palette nodes.

## Current Module Map

```text
web/src/
|-- utils/apl-parser/
|   |-- document.ts          parseDocument() and source line metadata
|   |-- parser.ts            action/condition parsing
|   |-- types.ts             Action, Segment, and Condition AST types
|   |-- pretty-log.ts        prettyAction() and prettyCond()
|   |-- build-graph.ts       document -> React Flow derivation
|   |-- grid-layout.ts       deterministic lane/row layout
|   `-- condition-layout.ts  logical expression and container layout
|-- components/
|   |-- canvas.tsx           React Flow canvas; currently read-only
|   |-- canvas/              Explorer, search, overrides, and graph helpers
|   |-- nodes/               custom graph node renderers
|   `-- apl-editor/          CodeMirror editor and completion/search support
`-- state/
    |-- editorStore.ts       canonical text actions and derived runtime state
    |-- derivation.ts        parse/build coordination
    `-- apl-runtime-builder.ts
```

## Current Editing Evidence

The Explorer is the closest existing example of a graph-adjacent edit pipeline:

- `graph-explorer-utils.ts` provides `replaceLineAt()` and `moveLine()`.
- `graph-explorer-action-leaf.tsx` parses drafts and prints action/condition text.
- `graph-explorer-section.tsx` calls `applyAplText()` with the next text.

Production canvas operations should reuse the behavior that is sound, but place it
behind pure operation-level tests rather than importing UI-local helpers into node
components.

## Deterministic Layout

| Lane | Contents |
| --- | --- |
| `root` | Profile |
| `block` | Action-list block |
| `action` | Action card |
| `expression` | Conditions, values, and logical containers |

Current core metrics in `grid-layout.ts`:

```text
LANE_WIDTH = 520
ROW_HEIGHT = 120
PROFILE_PADDING_ROWS = 2
```

Manual offsets may be layered over this base later, but structural edits must not
make unchanged nodes jump unpredictably.

## UI Stack

- React 19 and TypeScript
- `@xyflow/react` 12 for the graph canvas
- CodeMirror 6 for APL text editing
- Tailwind CSS 4 and Radix Tabs
- Zustand 5 for application state
- Vite for development/build
- Playwright for operation and browser-level tests

## Current Limitations

- React Flow uses `nodesDraggable=false`, `nodesConnectable=false`, and
  `elementsSelectable=false`.
- No accepted graph mutation boundary has been implemented yet.
- There is no full-document canonical printer; only action/condition printers and
  guarded line operations exist.
- Selection retention and shared undo/redo for external canvas edits still need to
  be proven.
- The accepted visual tokens and condition-builder states are documented but not
  implemented in production components.

## Next Implementation Reference

Follow [the graph-editing plan](plans/11-graph-editing.md). The first production
proof is one action-list-local canvas reorder that survives text update, rebuild,
reload, undo, and redo without mutating React Flow state directly.
