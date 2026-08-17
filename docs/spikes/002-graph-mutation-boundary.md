# SPK-002 - Graph mutation boundary

Status: Proposed
Owner: William
Target milestone: Graph editing
Timebox: One implementation vertical slice
Decision needed by: Before enabling canvas dragging or connecting

## Context

APL text is canonical and the React Flow graph is derived. The Explorer can
already replace and reorder source lines through `applyAplText()`, but the canvas
remains read-only and there is no implemented document mutation service or
full-document printer.

Graph editing needs one boundary that can validate an intent, produce valid next
text, preserve last-good recovery, and recover selection after the graph rebuilds.

## Question

Where should graph-edit intents become canonical document/text operations, and
what identity and history contract keeps that transition safe across rebuilds?

## Constraints and non-goals

- `aplText` remains the only canonical persisted state.
- React Flow nodes and the derived `AplDocument` are never mutated in place.
- Invalid or stale operations must leave text and last-good state unchanged.
- One committed gesture creates one undo/redo boundary.
- The spike proves action reorder only; it does not implement condition editing,
  cross-list moves, or free-form graph positioning.
- Existing SimC import work must be committed or deliberately separated first.

## Hypotheses

1. A pure operation layer can accept current text plus a guarded structural intent,
   reuse current line metadata/printing where sufficient, and return valid text.
2. Action reorder can prove the boundary without first building a full-document
   printer.
3. A revision/precondition plus a post-operation selection target is sufficient to
   avoid treating action index, line number, or React Flow node id as permanent
   identity.

## Experiment

Implement and test one action-list-local reorder:

```text
canvas reorder intent
  -> pure guarded operation
  -> reparse/validate next text
  -> applyAplText()
  -> deterministic graph rebuild
  -> selection recovery
```

Compare guarded source-line movement with document mutation/printing only as far as
needed to choose a production boundary. Record why the chosen approach can extend
to add/remove action and condition-expression operations.

## Evidence to Collect

- Operation API and target identity strategy.
- Successful, stale, invalid, inherited, and no-op test cases.
- Text before/after and semantic parse equivalence.
- CodeMirror/store undo and redo behavior for an external graph edit.
- Selection retention after action indexes and node ids change.
- Reload and auto-save behavior.
- Confirmation that React Flow state stays derived.

## Exit Condition

A tested canvas-to-text reorder operation survives rebuild, reload, undo, and redo
without direct mutation of derived nodes, and the selected mutation/identity
contract is documented for the remaining graph-editing slices.

## Decision

Pending.

## Follow-up

- Record the accepted contract in
  [the graph-editing implementation plan](../plans/11-graph-editing.md).
- Implement add/remove action using the same boundary.
- Start handle-driven condition editing only after the boundary is accepted.
