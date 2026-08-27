# Graph Editing Implementation Plan

Status: Ready after the SimC default-import work is committed or deliberately
separated
Updated: 2026-08-27

## Read First

- [Roadmap](../04-ROADMAP.md)
- [Accepted node visual language](../spikes/001-node-visual-language.md)
- [Accepted condition-builder board](../spikes/assets/001-condition-builder.png)
- [Graph feature](../05-GRAPH-FEATURE.md)
- [SPK-002 mutation-boundary spike](../spikes/002-graph-mutation-boundary.md)

## Start Here Next Session

1. Confirm the SimC default-import changes are committed or intentionally kept in
   a separate change set. Do not mix that feature with graph-editing mutations.
2. Run the existing production build and focused graph/parser tests to establish
   a baseline.
3. Start SPK-002 with one pure action-reorder operation. Do not enable general
   React Flow dragging or connecting yet.
4. Route the operation result through `applyAplText()` and verify text, graph,
   persistence, selection recovery, undo, and redo.
5. Only after that vertical slice is reliable, implement the accepted node tokens
   and then the condition-handle workflow described below.

Suggested baseline commands from `web/`:

```text
npm run build
npx playwright test tests/e2e/build-graph.test.ts
npx playwright test tests/e2e/apl-preview.spec.ts
```

The repository-wide lint command has known unrelated failures. Run focused lint
for touched files until that separate health item is resolved.

## Current Implementation Boundary

APL text is the source of truth. The canvas is still a derived, read-only React
Flow view:

```text
aplText
  -> applyAplText()
  -> parseDocument()
  -> AplDocument
  -> buildGraph()
  -> React Flow nodes and edges
```

Important existing entry points:

| Concern | Current file |
| --- | --- |
| Store mutation and last-good behavior | `web/src/state/editorStore.ts` |
| Document parsing and source line metadata | `web/src/utils/apl-parser/document.ts` |
| Action/condition AST types | `web/src/utils/apl-parser/types.ts` |
| Action and condition printing | `web/src/utils/apl-parser/pretty-log.ts` |
| Deterministic graph derivation | `web/src/utils/apl-parser/build-graph.ts` |
| Condition layout and containers | `web/src/utils/apl-parser/condition-layout.ts` |
| Read-only React Flow configuration | `web/src/components/canvas.tsx` |
| Existing line replace/reorder helpers | `web/src/components/canvas/graph-explorer-utils.ts` |
| Existing Explorer edit examples | `web/src/components/canvas/graph-explorer-action-leaf.tsx` |

The Explorer already replaces action source lines and reorders lines before
calling `applyAplText()`. Reuse that evidence, but move production graph mutations
behind a tested operation boundary rather than calling component-local text
helpers directly from canvas nodes.

There is currently no implemented `AplDocumentManager` or full-document printer.
SPK-002 must decide whether the first operations should use guarded source-line
patches, richer document mutation plus printing, or a staged combination. Do not
introduce a second canonical state beside `aplText`.

## Required Mutation Contract

The exact names are open to the spike, but the boundary must behave like this:

```typescript
type GraphEditIntent =
  | { type: "reorder-action"; source: ActionSelector; target: ActionSelector; placement: "before" | "after" }
  | { type: "add-condition-operand"; anchor: ConditionSelector; operator: "&" | "|"; expression: Condition }
  | { type: "delete-condition-operand"; target: ConditionSelector };

type ApplyGraphEditResult =
  | { ok: true; text: string; selectionTarget?: GraphSelectionTarget }
  | { ok: false; reason: string };
```

Requirements:

- Pure and deterministic for the same text, revision, and intent.
- Rejects stale, inherited, unsupported, or ambiguous targets.
- Produces valid text that reparses before `applyAplText()` is called.
- Never mutates React Flow nodes or the store's derived `AplDocument` in place.
- Returns enough identity information to recover selection after node ids and line
  numbers change.
- Creates one user-visible history boundary per committed graph operation.
- Leaves no partial state when validation, parsing, or printing fails.

Action index, source line number, and current graph node id are not durable identity
on their own because reordering changes them. SPK-002 must pair a source locator
with revision/precondition data and define how the result identifies the moved
action after rebuilding.

## Delivery Sequence

### Slice 1: Canvas-to-text action reorder

Prove the full pipeline with one action-list-local reorder:

```text
canvas intent
  -> pure reorder operation
  -> valid next APL text
  -> applyAplText()
  -> graph rebuild
  -> moved action reselected
```

Keep the gesture deliberately narrow. A node drag must not become a persisted
free-form position. Cross-list moves, inherited lines, parse-error state, and
collapsed/filtered ambiguity are rejected in this slice.

Exit criteria:

- Text order changes immediately and canonically.
- The graph rebuilds in the same semantic order.
- Reload preserves the change.
- Undo and redo traverse the change once each.
- Invalid/stale intents leave text and last-good state unchanged.
- Pure operation tests and a browser test cover the path.

### Slice 2: Accepted visual tokens and interaction states

Extract implementation tokens from SPK-001 instead of reopening visual design:

- soft semantic cards with dark readable text;
- neutral action-owned `IF` workspaces;
- condition mint, action orange, AND indigo, OR violet;
- thin solid connections with compact operator capsules;
- normal, hover, focus, selected, draft, deleting, disabled, warning, resolved,
  and impossible states;
- light/dark accessible equivalents and non-color cues;
- deterministic spacing and a two-dimensional minimum condition workspace.

Do not make the internal alignment grid imply or create edges.

### Slice 3: Condition creation from a handle

Accepted interaction:

1. Hovering or focusing the right handle enlarges it and reveals a centered `+`.
   Its accessible name and tooltip are `Add AND condition`.
2. Hovering or focusing the bottom handle does the same for
   `Add OR condition`.
3. Activating a handle draws a provisional operator-labeled connection and a
   focused draft condition card.
4. The draft exists only in canvas UI state. Escape/cancel removes it without a
   store mutation or history entry.
5. Committing a valid expression creates one graph-edit intent. The resulting
   text is validated, applied, and rebuilt as one history action.

The visual handle may remain compact, but its pointer/focus target must be large
enough to operate reliably. The `+`, tooltip, accessible name, operator label, and
horizontal/vertical direction prevent color from being the only cue.

### Slice 4: Condition deletion and normalization

Deleting a condition removes exactly that operand, then normalizes its expression:

```text
A & B                  delete B -> A
A & B & C              delete B -> A & C
A & (B | C)            delete C -> A & B
(A | B) & C            delete B -> A & C
```

Normalization rules to test before implementation:

- Promote the surviving sibling when a binary operator loses one operand.
- Flatten adjacent identical associative operators where safe.
- Preserve meaningful explicit grouping and operator precedence.
- Elide redundant visual containers after rebuilding.
- Never delete another condition merely because it shares an edge or container.

### Slice 5: Secondary grouping workflow

Marquee grouping is not the primary construction path. Add it only after direct
condition creation and deletion are stable.

- The selection must belong to one `IF` workspace and represent a complete,
  connected expression subtree.
- Preview the would-be container as an overlay; do not create a React Flow parent
  before the document operation commits.
- Show a disabled, muted preview with a reason when grouping has no logical effect.
- Derived logical containers are not palette nodes and are never independently
  persisted canvas objects.

### Future slice: Hierarchical Condition Groups

Add a tree-level **Condition Group** after the first graph-editing milestone. It
is a visual authoring abstraction that can contain ordered actions,
`call_action_list` / `run_action_list` nodes, and nested Condition Groups. It is
not the same thing as an expression-level logical container or a real SimC action
list.

```typescript
type APLNode = ActionNode | ConditionGroupNode | ActionListCallNode;

interface ConditionGroupNode {
  condition: Expression;
  children: APLNode[];
}
```

Compilation recursively traverses the visual tree, accumulates every ancestor
condition, combines inherited conditions with an action's own `if=` expression
using `&`, and emits a flat action sequence. The traversal order is depth-first
and follows the displayed sibling order so the visual tree remains the source of
truth for SimC priority.

```text
IF buff.shadow_dance.up
|- secret_technique [combo_points>=5]
|- eviscerate [combo_points>=6]
`- IF energy>=60
   `- shadowstrike

-> actions+=/secret_technique,if=buff.shadow_dance.up&combo_points>=5
-> actions+=/eviscerate,if=buff.shadow_dance.up&combo_points>=6
-> actions+=/shadowstrike,if=buff.shadow_dance.up&energy>=60
```

Requirements:

- Users can create, nest, reorder, move into, and move out of Condition Groups.
- Reordering actions or groups changes emitted priority visibly; do not preserve
  an earlier flat position through hidden ordering metadata.
- Moving existing actions into or out of a group may intentionally change both
  inherited conditions and priority. Preview or explain that consequence in the
  UI before commit.
- Empty groups and invalid group conditions remain drafts and never print invalid
  APL text.
- Parent and child expressions print with precedence-preserving parentheses when
  required; logical equivalence must not rely on string concatenation alone.
- Actual `call_action_list` and `run_action_list` children remain emitted SimC
  control-flow actions. A Condition Group never creates or replaces an action
  list definition or call.
- The document/tree model, not React Flow parentage, is canonical.

Tests must cover inherited conditions across multiple nesting levels, actions
with and without local conditions, precedence-preserving combination, depth-first
priority after group/action reordering, moves across group boundaries, and real
action-list calls nested inside visual groups.

## `IF` Workspace and Container Rules

- The action ownership edge stops at the outer `IF` boundary handle.
- The `IF` workspace owns its condition graph but is not a logical operator or
  parenthesis node.
- It reserves visible horizontal and vertical growth room and expands by rows or
  columns as needed.
- Pure root AND/OR chains remain container-free.
- Mixed precedence and meaningful explicit groups derive neutral dashed logical
  containers.
- Redundant parentheses remain valid source syntax but do not require a visible
  container.

## Test Matrix

Operation-level tests:

- successful/no-op/stale action reorder;
- inherited and parse-error rejection;
- `A -> A&B` and `A -> A|B` insertion;
- extension of existing AND/OR chains;
- mixed-precedence insertion and printing;
- deletion normalization and container elision;
- explicit parentheses and `target_if` preservation;
- invalid draft never reaching the store.

Browser tests:

- handle hover/focus renders the in-handle `+`;
- keyboard and pointer activation open the correct draft;
- Escape cancels without changing text;
- commit changes text and graph once;
- delete removes the operand and redundant operator;
- selection follows the committed result;
- undo/redo, reload, auto-save off/on, and last-good behavior;
- no free-form connection or unsupported cross-workspace gesture is accepted.

Regression tests:

- deterministic node ids/positions for unchanged text;
- existing Explorer edits still work;
- collapse, search, talent rendering, condition overrides, and source navigation
  remain intact.

## Non-goals for the First Milestone

- Arbitrary edge drawing.
- Persisted free-form node positions.
- Cross-action or cross-`IF` condition connections.
- A general visual expression language for arithmetic.
- Persisting empty placeholder conditions in APL text.
- Treating React Flow nodes or containers as canonical state.
- Hierarchical Condition Groups; they are the future slice described above, not
  part of the initial reorder and condition-expression milestone.

## Handoff Definition

The next session is successfully unblocked when it can start SPK-002 without
revisiting visual design, and the first implementation PR can prove one complete
canvas-to-text reorder slice with operation and browser coverage.
