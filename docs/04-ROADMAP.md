# Wizualizer - Roadmap

Last updated: 2026-08-27

## How this roadmap works

This is the status view for product work. Detailed implementation plans belong in
`docs/plans/`; short, time-boxed investigations belong in `docs/spikes/`.

- **Now** is the single milestone being finished.
- **Next** is the agreed milestone that follows it.
- **Later** is ordered loosely and should not be treated as a commitment.
- **Spikes** answer a named question before implementation. A spike ends with a
  recommendation or an explicit decision not to proceed.
- Completed work stays summarized here so the roadmap does not drift back into a
  list of features that already exist.

## Product goal

Build a visual APL editor that preserves canonical text while making real APLs
easier to understand and safely edit from either the text or the graph.

Success means:

- text -> AST -> graph -> edit -> canonical text is safe and predictable;
- invalid work never destroys the last-good document;
- graph layout and editing behavior remain deterministic;
- the visual language makes large APLs easier to scan instead of adding noise.

## Completed foundation

- Canonical APL parser and printer with round-trip coverage.
- Last-good fallback and structured parse diagnostics.
- Deterministic, derived graph layout with structural node types.
- Collapsible blocks and action details, graph search, and source/graph navigation.
- Named local APL library with manual save, auto-save, duplication, and switching.
- Editor search, completion, folding, undo-history preservation, and scroll
  preservation across tabs.
- Talent-aware rendering, semantic catalogs, condition overrides, and condition
  truthiness feedback.
- Cached and debounced graph builds to keep the preview responsive on large APLs.

## Now - Ship SimC default APL import

Status: **commit-ready; awaiting commit**

Users can create an empty APL or choose a SimulationCraft MID1 default by class,
specialization, and hero variant. The chosen profile is fetched from SimC,
created as a uniquely named local APL, and opened immediately.

Exit checklist:

- [x] Generated, versioned profile manifest and regeneration command.
- [x] Class/spec/variant picker with loading, failure, retry, and cache behavior.
- [x] Imported text enters the normal library/runtime pipeline.
- [x] New feature files pass lint.
- [x] Production build passes.
- [x] Focused and editor/preview regression suites pass.
- [ ] Commit the finished feature.

Known repository health item: the full lint command currently reports 36
pre-existing errors outside this feature. Track that cleanup separately; do not
let the graph-editing milestone silently grow to include it.

## Next - Graph editing

Status: **visual direction accepted; mutation-boundary spike starts after the SimC commit**

The first outcome is one trustworthy vertical slice where a graph interaction
changes the canonical APL text and survives rebuild, reload, undo, and redo. The
recommended first slice is reordering actions within one action list: it is useful
on its own and exercises ordering, AST mutation, printing, persistence, and layout
stability without requiring a full free-form graph grammar.

### 1. Visual language - accepted

[SPK-001](spikes/001-node-visual-language.md) accepted soft semantic cards,
action-owned `IF` workspaces, clean operator-labeled connections, and direct
condition creation from in-handle `+` affordances.

The accepted board covers handle hover, draft, commit, derived container, delete,
and automatic connector cleanup. Production work still needs to extract exact
theme tokens and fill out the remaining root/block/action/variable and state
matrix; that is implementation follow-up, not another direction-finding pass.

### 2. Prove the edit pipeline

Run [SPK-002](spikes/002-graph-mutation-boundary.md) for the mutation boundary:

`graph intent -> document/AST operation -> canonical print -> editor store -> graph rebuild`

The spike must settle operation identity, failure behavior, selection retention,
history boundaries, and how source locations are recovered after printing.

Exit condition: a tested reorder operation with no direct mutation of derived
React Flow nodes.

### 3. Deliver graph editing incrementally

Proposed order:

1. Reorder actions within a list.
2. Add and remove actions.
3. Edit an action name and its arguments/condition.
4. Move actions between compatible lists.
5. Implement the accepted handle-driven condition draft/commit/delete workflow
   only after the mutation boundary is proven.
6. Add secondary marquee grouping after direct condition editing is stable.

Every increment must preserve canonical text, last-good recovery, deterministic
layout, editor/graph selection, and undo/redo behavior.

### Milestone exit criteria

- A user can make a meaningful structural APL change from the graph.
- The text editor immediately shows the canonical equivalent.
- The edit survives reload and round-trips back to the same document meaning.
- Undo/redo works across graph and text edits without separate histories.
- Invalid or unsupported graph gestures cannot corrupt saved text.
- Graph editing is covered by operation-level and browser-level tests.

## Later

Ordered loosely; promote only one item to **Next** when graph editing reaches its
milestone exit criteria.

1. Semantic validation UX for unknown references and type mismatches.
2. More robust import/export workflows and explicit recovery affordances.
3. Profileset management.
4. Optional manual node offsets layered over deterministic layout.
5. Hierarchical Condition Groups that can contain ordered actions and nested
   groups. Parent conditions are inherited with `&`, while depth-first visual
   order remains the source of truth for the generated flat APL priority. Keep
   these visual groups distinct from SimC `call_action_list` and
   `run_action_list` control flow.
6. Advanced condition-expression editing and detail views.
7. Bundle splitting and repository-wide lint cleanup.

## Spike register

| Spike | Question | Status | Target milestone | Outcome |
| --- | --- | --- | --- | --- |
| [SPK-001](spikes/001-node-visual-language.md) | What should the simpler node visual language be? | Accepted | Graph editing | Handle-driven connection workflow accepted |
| [SPK-002](spikes/002-graph-mutation-boundary.md) | Where should graph edit intents become canonical document/text operations? | Proposed | Graph editing | Start after the SimC commit |
| SPK-003 | Which action reorder/add/remove gestures avoid fighting canvas navigation? | Proposed | Graph editing | Condition-add gesture resolved by SPK-001; action gestures remain |

Use the template and lifecycle in [docs/spikes/README.md](spikes/README.md) when a
new uncertainty needs investigation.

## Change log

- **2026-08-27:** Added hierarchical Condition Groups as a later graph-editing
  feature, with inherited conditions and depth-first visual priority semantics.
- **2026-08-17:** Accepted SPK-001; documented the handle-driven condition
  workflow; added the graph-editing implementation handoff and SPK-002 entry point.
- **2026-08-17:** Replaced the phase-only roadmap with status-based Now/Next/Later
  milestones; selected graph editing as next; added a spike workflow and node
  visual-language spike.
