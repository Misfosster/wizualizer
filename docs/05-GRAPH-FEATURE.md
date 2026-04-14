# Graph Feature

This document explains the APL graph view: how it is built, why it is laid out the way it is, and which tradeoffs are intentional.

## Data Flow

APL text remains the source of truth. The graph is a derived view.

```text
APL text
  -> parseDocument()
  -> AplDocument
  -> buildGraph()
  -> React Flow nodes + edges
  -> Canvas
```

On parse errors, the UI keeps the last valid graph. Invalid text should not corrupt the working graph state.

## Main Rule

Graph state does not own canonical APL. Parsed APL owns structure; graph nodes and edges are a visualization of that structure.

This keeps the system predictable:
- Parse errors do not destroy the last valid graph.
- The same input produces the same graph.
- Tests can assert exact node ids and positions.
- Future canvas-to-APL edits have a clear route: graph edit -> document edit -> printed APL.

## Main Files

```text
web/src/utils/apl-parser/document.ts
  Parses APL text into AplDocument.

web/src/utils/apl-parser/build-graph.ts
  Converts AplDocument into React Flow nodes and edges.

web/src/utils/apl-parser/condition-layout.ts
  Converts condition expressions into condition/value/container nodes.

web/src/utils/apl-parser/grid-layout.ts
  Defines lane and row layout math.

web/src/components/canvas.tsx
  Renders the React Flow canvas.

web/src/components/nodes/
  Contains custom graph node components.

web/src/state/editorStore.ts
  Stores text, parse state, collapsed blocks/actions, nodes, and edges.
```

## Node Kinds

| Kind | Meaning |
| --- | --- |
| `root` | Profile node with profile name, block count, and action count. |
| `block` | APL action list block, for example `actions` or `actions.precombat`. |
| `action` | Standard action spell. |
| `variable` | `variable` or `cycling_variable`. |
| `useItem` | `use_item` or `use_items`. |
| `callActionList` | `call_action_list` or `run_action_list`. |
| `sequence` | `sequence` or `strict_sequence`. |
| `condition` | Leaf condition node. |
| `valueExpression` | Variable value expression node. |
| `container` | Visual logic group, usually parentheses or a contested AND group. |

Action node type is selected in `getActionNodeKind()`:

```text
variable, cycling_variable -> variable
use_item, use_items -> useItem
call_action_list, run_action_list -> callActionList
sequence, strict_sequence -> sequence
everything else -> action
```

This lets each card show the useful fields for its action type, such as item name, variable name, variable value, or target action list.

## Node Ids

Node ids are deterministic so tests, collapse state, and rebuilds remain stable.

Examples:

```text
root__0
block__0__actions
action__0__actions__3
condition__0__actions__3__if
valueExpression__0__actions__0__value
```

Action ids follow this shape:

```text
action__{profileIndex}__{blockName}__{actionIndex}
```

`collapsedActions` can therefore store action ids directly.

## Edges

Normal graph edges represent ownership or flow:

```text
root -> block
block -> action
action -> first condition
action -> value expression
```

Boolean edges represent condition logic:

```text
condition A --AND--> condition B
condition A --OR--> condition B
condition A --XOR--> condition B
```

Handle conventions:

- AND uses right-to-left handles.
- OR and XOR use bottom-to-top handles.
- Edge labels show the logical operator directly on the connection.

This makes the visual grammar consistent: AND reads horizontally, OR/XOR reads vertically.

## Condition Logic

The parser must respect real operator precedence. The graph builder should not split expressions with string manipulation.

Default graph behavior only expands top-level logical structure. Comparison expressions are treated as atomic condition nodes, even when their operands contain arithmetic.

Example:

```text
cooldown.lava_lash.remains<gcd.max+buff.maelstrom_weapon.stack*0.3
```

Graph:

```text
[cooldown.lava_lash.remains<gcd.max+buff.maelstrom_weapon.stack*0.3]
```

Example:

```text
buff.maelstrom_weapon.stack>=5&cooldown.lava_lash.remains<gcd.max
```

Graph:

```text
[buff.maelstrom_weapon.stack>=5] --AND--> [cooldown.lava_lash.remains<gcd.max]
```

Arithmetic inside comparisons stays inside the node label. It is not expanded into `+`, `*`, or `%` graph nodes in the normal view.

## Container Rules

A container is a dashed visual group.

Containers are used when they add logical clarity:

- Explicit logical parentheses change grouping.
- An AND group is a branch inside OR/XOR and needs to read as one branch.
- Nested logical groups need visible scope.

Containers are not used for redundant parentheses around comparisons or arithmetic-only subexpressions.

This stays one condition node:

```text
(cooldown.lava_lash.remains<gcd.max+(foo.bar*0.3))
```

This gets a container around `a|b`:

```text
(a|b)&c
```

This respects precedence as `(a&b)|c`:

```text
a&b|c
```

The graph shows `a&b` as a grouped AND branch under OR.

## Layout

The graph uses a deterministic grid, not force layout.

| Lane | Contents |
| --- | --- |
| `root` | Profile |
| `block` | Action list block |
| `action` | Action card |
| `expression` | Value and condition graph |

Key values in `grid-layout.ts`:

```text
LANE_WIDTH = 520
ROW_HEIGHT = 120
PROFILE_PADDING_ROWS = 2
EXPRESSION_NODE_BOUNDS = 280 x 48
```

The expression lane is shifted left by 35% of the default empty space after a base action node. This shortens action-to-condition edges without compressing root, block, and action lanes.

Action sections use a half-row gap:

```text
ACTION_SECTION_GAP_ROWS = 0.5
```

The grid keeps graph positions stable across rebuilds, collapse changes, and nearby text edits.

## Action Alignment

Some action cards have secondary text:

```text
use_item
call_action_list
sequence
```

These cards are taller than plain action cards. `build-graph.ts` estimates the default source handle center from card structure:

```text
border + vertical padding + header + optional note
```

The action node y-position is then adjusted so its source handle aligns with the first condition entry. This reduces unnecessary bends in the first action-to-condition edge.

## Collapse

Collapse state is held separately for blocks and actions:

```text
collapsedBlocks: Set<string>
collapsedActions: Set<string>
```

Block collapse hides all actions inside the block.

Action collapse hides only the action detail graph:

- variable value expression
- conditions
- nested condition/value containers

The action card remains visible, so a user can isolate a single action.

When a block expands, collapsed actions inside that block are expanded too. `Expand All` also clears collapsed action state.

## Canvas Rendering

The canvas uses React Flow with these important options:

```text
onlyRenderVisibleElements = true
nodesDraggable = false
nodesConnectable = false
elementsSelectable = false
```

Rationale:

- Visible-only rendering helps larger graphs.
- Dragging and connecting should wait until graph edits can round-trip to APL.
- Selection is not a core workflow yet.

The background is a dark radial gradient with subtle dots to make the graph read as a workspace.

On `Collapse All`, the canvas calls `fitView()` and then anchors the first node near:

```text
x = 33% from left
y = 25% from top
```

This gives a better starting view than raw `fitView()` when the graph becomes compact.

## Performance

Graph rebuilds still happen when text or collapse state changes. This is simple and safe, but not the final performance ceiling.

Current optimizations:

- Canvas uses a shallow Zustand selector.
- Editor shell uses a shallow Zustand selector.
- Collapse buttons call store actions at event time instead of subscribing each node.
- Condition measurement uses a `WeakMap` cache.
- Empty collapsed sets skip document-pruning walks.
- Stable React Flow props are hoisted.

The larger future optimization is to decouple textarea typing from immediate graph rebuilds:

```text
textarea draft updates immediately
parse/build runs deferred or debounced
preview flushes draft before showing graph
```

This changes parse error timing, so it should be done deliberately.

## Tests

Main tests:

```text
web/tests/e2e/build-graph.test.ts
web/tests/e2e/apl-preview.spec.ts
```

Build graph tests cover:

- node kinds
- deterministic ids
- deterministic positions
- collapsed blocks
- collapsed actions
- AND/OR handles
- comparison expressions as atomic nodes
- arithmetic inside comparisons staying unexpanded
- explicit logical parentheses still producing groups

Preview tests cover:

- graph rendering from pasted APL
- tab persistence
- block collapse/expand
- action collapse/expand
- `Expand All`
- last-good graph behavior after parse errors

## Why Not Force Layout

APL order matters, so the layout should preserve order and avoid movement between rebuilds.

Force-directed layout may look good for static diagrams, but it can shift nodes when text changes. That is bad for an editor. The deterministic grid is less clever, but easier to reason about and test.

Manual drag offsets can be added later on top of the deterministic base layout.

## Future Work

- Search/filter actions by condition text, action text, or negative tokens like `!foo`.
- Manual node drag with persisted offsets.
- Canvas-to-APL reorder.
- Optional expression detail mode for full AST math trees.
- Match highlighting in filter mode.
- Better edge routing for long labels.
- Smarter overlap checks for very long action cards.

## Summary

- APL text is the source of truth.
- The graph is derived from the parsed document.
- The grid keeps layout deterministic.
- Comparisons stay atomic in the normal view.
- AND flows horizontally.
- OR/XOR flows vertically.
- Containers show meaningful logical groups.
- Collapse hides detail without losing structure.
- Tests protect graph semantics and layout stability.
