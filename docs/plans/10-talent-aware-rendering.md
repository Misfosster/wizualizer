# Talent-Aware Graph Rendering

Render the Preview graph with awareness of which talents a profile actually has, by decoding each profile's `talents=` export string against a committed, generated talent catalog.

This plan does not add a full talent-tree UI. It adds a small Preview control panel and a graph rendering mode that fades or hides actions whose `if` / `target_if` conditions are definitely impossible given the selected talents.

## Goals

- decode each profile's `talents=` export string into a set of selected talent ranks keyed by SimC talent key
- evaluate `talent.*` references inside action conditions with typed three-valued logic (`bool | number | unknown`)
- mark an action as "impossible" only when its condition is definitely `false`, never when it is `unknown`
- offer three render modes in the Preview canvas: `Off`, `Dim impossible`, `Hide impossible`
- default to `Dim` so APL author intent is preserved
- in `Hide` mode, render the graph as if impossible actions were never in the source text at all
- fail safely when a profile has no talents, an unsupported spec, a malformed export string, or a tree-hash mismatch

## Non-Goals (v1)

- live Battle.net or Raidbots API calls
- rendering a full talent tree UI
- evaluating `profileset.*+=talents=...` overrides
- variable-aware evaluation (an `if=variable.foo` stays `unknown` even if `variable.foo` was assigned from a `talent.*` source)
- per-profile render mode selection (single global mode for v1)
- per-profile activation state ("active" vs "inactive copy"); v1 filters every profile uniformly using its own talent selections
- additional filter dimensions beyond talents (target count, consumables, gear, set bonuses)
- target simulation or actor-wide runtime evaluation

## UX Design

### Preview Controls Panel

Place a compact panel in the Preview canvas next to the existing `Collapse/Expand All` button.

- mode selector as a three-option segmented control: `Off`, `Dim`, `Hide`
- one decode-status row per profile, e.g. `Enhancement: 28 talents loaded` or `Copy of Enhancement: inherited`
- in `Hide` mode, each decode-status row also shows "N actions hidden" so the count of vanished actions has exactly one predictable home
- a small warning row when a profile has a `talents=` line that could not be decoded, with a one-line reason ("missing catalog for spec", "version mismatch", "malformed string")
- a quiet info row when `profileset.*+=talents=...` lines are present, noting they are not applied yet
- mode value is persisted in `localStorage` and defaults to `Dim`

### Why Dim is Default (UX Rationale)

- Nielsen "visibility of system status": users still see the original APL the author wrote
- Nielsen "recognition over recall": dimmed actions are still readable and findable
- Hick's Law: three modes is a small, fixed set; segmented control is appropriate, no progressive disclosure needed
- Fitts's Law: the panel sits near the existing canvas controls and uses the same affordance, so the CTA stays close to its initiating context
- Jakob's Law: dim + a small "talent-gated" badge follows the same pattern users already know from feature flags and disabled UI

### Visual Rules

- `Off` is the current behavior with no styling overrides and no condition pre-evaluation.
- `Dim` mode must not rely on opacity alone. Add a small "talent-gated" badge on the action header so the state is visible to color-blind users and on low-contrast monitors. Dimmed text must stay above WCAG AA 4.5:1 contrast. Suggested baseline: 0.55 opacity on the action body, badge with full contrast.
- `Dim` mode also dims the edges from a dimmed action to its impossible condition subtree, not just the nodes. Otherwise the visual hierarchy reads incorrectly.
- `Hide` mode renders the graph as if the impossible action lines were never in the source text. No node, no edge, no badge, no header, no count. The only place the user learns that anything was hidden is the decode-status panel row for that profile.

### Hide Mode Semantics

Hide mode is a "render as if" transformation, not a "fade and hide" overlay:

- impossible actions are omitted entirely, along with their condition and value subtrees
- the parent block's edge to that action is omitted
- if every action in a block becomes impossible AND the block is not referenced by a surviving `call_action_list`, the block disappears too (header, edge from root, all of it)
- if every block in a profile disappears, the profile's root node disappears
- vertical layout compacts as if the omitted sections were never there; no whitespace is left behind
- the editor store's collapse state still references the document, not the graph, so collapse state survives Off → Hide → Off round trips with no surprises

Referenced-block exemption:

- a target block stays visible only if a *surviving* `call_action_list` action targets it
- this prevents "hidden invoker → target block → another hidden invoker" chains from keeping unreachable blocks alive
- compute the surviving call-target set after action filtering, not before

Empty graph fallback (Nielsen "visibility of system status"):

- if Hide leaves zero surviving nodes across the whole document, render a single placeholder card on the canvas with text along the lines of "All actions are filtered out by your talents — switch to Off or Dim"
- the placeholder is a regular React component on the canvas, not a node, so it does not interact with React Flow's layout

## Data Sources and Catalog

### Catalog Generator

Add `npm run generate:talents` as a manual maintenance command. Generated JSON is committed.

The first implementation step is a SimC extraction spike to confirm source files, export-string node order, tree hash format, hero-talent shape, and canonical SimC talent keys.

Upstream source of truth: SimC's own talent data. Pulling SimC's canonical talent name for each node lets us use the exact SimC key directly and reduces the override map to near zero. Two practical options, in order of preference:

1. parse SimC's `engine/dbc/generated/trait_data.inc` and the related class/spec tables out of a checked-out SimC repo (path is configurable in the script)
2. parse the JSON dumps produced by `dbc_extract` (slightly noisier, but no C++ parsing)

If the user has neither available locally, the script should print a clear instruction with a link.

The generator must also embed a `treeHash` per spec, captured from the same SimC build, so we can detect tree-hash mismatches at decode time.

### Catalog Layout on Disk

```
web/src/data/talents/
  index.json          # { gameVersion, classes: ["shaman", "mage", ...] }
  shaman.json         # all shaman specs
  mage.json
  ...
```

Each spec entry contains:

- `classId`, `specId`
- `treeHash`
- ordered list of class-tree and spec-tree nodes (matches export-string node order)
- per node: `talentId`, `displayName`, `simcKey`, `maxRank`, optional `row`, `col`
- hero-tree nodes if applicable

Bundle budget: keep the initial bundle small. If aggregate JSON exceeds ~100 KB, dynamic-import per class so only the classes referenced by the user's APL load.

### SimC Key Strategy

- prefer the SimC key emitted by the generator straight from upstream data
- fall back to a `simmifyTalentName(displayName)` heuristic only if upstream is missing a key
- keep an explicit `overrides` map for the small set of legitimate exceptions

This pushes correctness to generation time, not runtime, and keeps the runtime decoder dumb.

## Document Parsing Changes

`AplDocument` stays syntax-only. It holds what was in the text, never an interpretation of it. Decoded talent selections live in derived editor state, not on `AplProfile`.

### New Profile Lines

- `spec=<spec_name>` updates the current profile's `specName`
- `talents=<export_string>` updates the current profile's `talentExport`

Both lines apply to the most recently introduced profile. They reset on the next class profile line (e.g. `shaman="..."`).

### `copy=` Inheritance Semantics

When `copy="X"` is encountered:

- snapshot `className`, `specName`, and `talentExport` from the previous profile by value
- subsequent `talents=` or `spec=` lines on the copy override only the copy
- the source profile is unaffected by edits made to the copy

This matches "inherits unless later overridden" and avoids surprising live-link behavior.

### Other Lines

- gear, config, profileset, and APL action lines continue to work as today
- `profileset.*+=talents=...` is parsed as a profileset override but is not applied to graph rendering in v1; its presence is surfaced as an info message in the panel

## Public Types

Extend `AplProfile` with syntax-only metadata:

```ts
interface AplProfile {
  name: string;
  className: string;
  blocks: AplBlock[];
  specName?: string;
  talentExport?: string;
}
```

Add talent data, evaluation, and selection types:

```ts
type TalentRenderMode = "off" | "dim" | "hide";

type EvalValue =
  | { kind: "bool"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "unknown" };

type TalentStatus =
  | { kind: "absent" }                 // no talents= line on profile
  | { kind: "decoded" }
  | { kind: "unsupported_spec" }
  | { kind: "missing_catalog" }
  | { kind: "version_mismatch" }
  | { kind: "malformed_export" };

interface TalentNodeEntry {
  talentId: number;
  displayName: string;
  simcKey: string;
  maxRank: number;
  row?: number;
  col?: number;
}

interface TalentSpecCatalog {
  classId: number;
  specId: number;
  treeHash: string;
  classNodes: TalentNodeEntry[];
  specNodes: TalentNodeEntry[];
  heroNodes?: TalentNodeEntry[];
}

interface TalentCatalog {
  gameVersion: string;
  byClassSpec: Record<string, TalentSpecCatalog>; // key: "shaman/enhancement"
}

interface TalentSelectionResult {
  status: TalentStatus;
  selections: Record<string, number>; // simcKey → rank
  hiddenActionCount: number;          // populated by graph build for the panel
}
```

`absent` is not an error and does not produce a UI warning. The other failure kinds map to specific messages.

Extend graph options:

```ts
interface BuildGraphOptions {
  talentRenderMode?: TalentRenderMode;
  talentSelectionsByProfile?: ReadonlyMap<number, TalentSelectionResult>;
}

function buildGraph(
  document: AplDocument,
  collapsedBlocks?: ReadonlySet<string>,
  collapsedActions?: ReadonlySet<string>,
  options?: BuildGraphOptions,
): GraphResult;
```

Extend graph node data only as needed:

```ts
type TalentState = "normal" | "impossible" | "unknown";

// added to ActionNodeData and friends, plus ConditionNodeData / ValueExpressionNodeData
talentState?: TalentState;
```

`talentState` is only meaningful in `Off` (always `"normal"`, can be omitted) and `Dim`. In `Hide`, impossible nodes are not present in the graph at all, so the field is unused. This keeps the metadata footprint minimal.

Edges from a dimmed action to its condition tree get a corresponding dimmed `style` in `Dim` mode, derived from endpoint `talentState`.

## Talent Decoder

Module: `web/src/utils/talents/decode-export.ts`.

- inputs: `talentExport` string, `TalentSpecCatalog`
- outputs: `TalentSelectionResult` (with `hiddenActionCount: 0` initially; the graph builder fills it in)
- mirrors SimC's export-string format. Reference implementations to track:
  - SimC `player_t::parse_talent_url`, `dbc_t::talent_string_decode`
  - wowsims and Raidbots open-source utilities
- if the embedded tree hash does not match the catalog's `treeHash`, return `version_mismatch`
- if any byte/bit-length check fails, return `malformed_export`
- never throw; always return a `TalentSelectionResult`

## Talent Condition Evaluator

Module: `web/src/utils/talents/evaluate-condition.ts`.

Recognized identifiers (return concrete `EvalValue`):

- `talent.<key>` → `{ kind: "bool", value: rank > 0 }`
- `talent.<key>.enabled` → alias of above
- `talent.<key>.rank` → `{ kind: "number", value: rank }`

Anything else (`buff.*`, `cooldown.*`, `variable.*`, `target.*`, `equipped.*`, `set_bonus.*`, etc.) returns `{ kind: "unknown" }`. There is no string variant of `EvalValue`; any operand that would produce a string reduces to `unknown`.

Reduction rules (with `?` meaning `unknown`):

- `&` (and): `false & ? = false`, `true & ? = ?`, `? & ? = ?`
- `|` (or): `true | ? = true`, `false | ? = ?`, `? | ? = ?`
- `!` (not): `!? = ?`
- `^` (xor): any operand `?` propagates `?`
- numeric comparisons (`<`, `<=`, `>`, `>=`, `=`, `==`, `!=`) reduce to `bool` only when both operands are concrete numbers; otherwise `?`
- arithmetic (`+ - * / % %%`) returns `number` only when both operands are concrete numbers; otherwise `?`
- string-match operators (`~`, `!~`) and equality on identifier operands always return `?` because no talent reference is string-typed
- the `floor`/`ceil` calls fold when their argument is a concrete number; otherwise `?`

### Action Eligibility Mapping

For each action, evaluate `if` and `target_if` segments separately, then combine:

- `if=<expr>` is action eligibility. If `expr` evaluates to `false`, the action is impossible. Anything else (including `?`) is not impossible.
- `target_if=<expr>` and `target_if=first:<expr>` are filtering target selection. If `expr` evaluates to `false` from talents alone, no target can match, so the action is impossible.
- `target_if=min:<expr>` and `target_if=max:<expr>` are *ranking* modes, not filters. They always pick some target. They are never used to mark an action impossible in v1.
- multiple `target_if` segments combine the same way.

An action is `impossible` iff any one of these eligibility conditions evaluates to `false`. Otherwise it is `normal` (when the conditions evaluate to `true`) or `unknown` (when they reduce to `?`).

### Performance

Memoize evaluation per `(actionId, selectionsRef)` so repeated graph rebuilds (collapse toggles, mode switches) do not re-walk every condition tree.

## Graph Building Changes

`buildGraph` updates:

- read `talentRenderMode` and `talentSelectionsByProfile` from `options`
- for each profile, evaluate every action's eligibility against that profile's selections
- when mode is `off`: do not evaluate, do not tag, behave exactly as today
- when mode is `dim`: keep all nodes and edges, tag impossible action subtrees and edges with `talentState`
- when mode is `hide`: omit impossible actions and their subtrees entirely, then run the survival pass below

### Hide Mode Survival Pass

1. compute the impossible-action set per profile by combining contributions from every active filter dimension (in v1: only talent eligibility). Keep this step a single function with a stable signature so future dimensions plug in next to talents instead of replacing them.
2. compute the *surviving* `call_action_list` invokers (call-action-list actions that are themselves not impossible)
3. compute the referenced-block-set: the union of every block name targeted by a surviving invoker
4. for each profile:
   - drop impossible actions and their condition/value subtrees
   - drop blocks that are both empty after step (a) and not in the referenced-block-set
   - drop the profile root if no blocks remain
5. compact layout so removed sections leave no whitespace (advance row cursors only over surviving content; do not allocate `PROFILE_PADDING_ROWS` for an eliminated profile)
6. if no profile survives, return an empty graph; the canvas component renders a placeholder card

Step 1 is the only step that ever needs to change when a future filter dimension is added. Steps 2–6 are dimension-agnostic.

Stable IDs across modes:

- `actionIndex` continues to mean the position in the source block's actions array
- hidden actions do not shift the indices of surviving actions
- Block IDs and action IDs are therefore stable across mode switches, so user collapse state survives Off → Hide → Off

After the graph is built, populate `hiddenActionCount` on each profile's `TalentSelectionResult` so the panel can show the per-profile hidden count.

Determinism: same input now means same `(document, collapsedBlocks, collapsedActions, talentRenderMode, talentSelectionsByProfile)`. Within a single mode, coordinates remain stable.

## Editor Store Changes

- add `talentRenderMode: TalentRenderMode` and `setTalentRenderMode(mode)`
- persist mode in `localStorage` (`logiccraft.talentRenderMode`), default `Dim`
- compute `talentSelectionsByProfile` whenever the document changes, by walking `document.profiles` and decoding each profile's `talentExport` (this is derived state; it does not live on `AplProfile`)
- pass mode and selections through to `buildGraph` from every place it is currently called (`applyAplText`, `toggleActionCollapse`, `toggleBlockCollapse`, `toggleAllBlocksCollapse`, and the new `setTalentRenderMode`)
- existing collapse-state pruning continues to validate IDs against the document, not the graph, so a Hide-mode rebuild does not erase the user's collapse state for hidden blocks

## Module Layout

Single-responsibility split, well under the project's file-length rules:

```
web/src/utils/talents/
  catalog-loader.ts          # spec → catalog entry; supports dynamic per-class import
  decode-export.ts           # export string → selections; no throws
  evaluate-condition.ts      # AST + selections → EvalValue
  action-eligibility.ts      # if/target_if mapping → "normal" | "impossible" | "unknown"
  simc-key.ts                # simmify + overrides (used only as a fallback)
  types.ts

web/src/utils/filters/
  compute-impossible-set.ts  # combines per-dimension contributions → Set<actionId> per profile
                             # v1 contribution: talent eligibility only

web/src/utils/apl-parser/
  document.ts                # +spec=, +talents=, +copy snapshot semantics
  build-graph.ts             # +options.talentRenderMode, +options.talentSelectionsByProfile
                             # + Hide survival pass

web/src/components/canvas/
  TalentModePanel.tsx        # segmented control + decode status rows
  EmptyGraphPlaceholder.tsx  # shown when Hide eliminates everything

web/src/data/talents/
  index.json
  <className>.json
```

Generator script:

```
web/scripts/generate-talents/
  index.ts                   # entrypoint
  read-simc-source.ts        # parse trait_data.inc
  emit-catalog.ts            # write JSON + index
```

## Tests

### Parser / Document

- parses `spec=` and `talents=` lines
- `copy=` snapshots class, spec, and talent export
- a copied profile that later sets `talents=` does not mutate its source
- profileset talent lines do not crash and surface in document data
- existing action parsing and validation continue to pass

### Talent Decoder

- decodes a known fixture export string against a small fixture catalog
- produces selected ranks keyed by SimC key
- reports `unsupported_spec`, `missing_catalog`, `version_mismatch`, and `malformed_export` for the corresponding inputs
- never throws

### Talent Evaluator

- `talent.hot_hand` and `talent.hot_hand.enabled` are equivalent
- `!talent.hot_hand` flips the result
- `talent.foo.rank>=2` reduces correctly with known and unknown ranks
- `talent.a.enabled & buff.x.up` is `unknown` when talent is taken, `false` when talent is not taken
- `talent.a.enabled | buff.x.up` is `true` when talent is taken, `unknown` otherwise
- arithmetic: `talent.foo.rank*2>=4` evaluates when rank is known, stays `unknown` when not
- `~`, `!~`, and identifier-equality operands stay `unknown`
- `floor(talent.foo.rank/2)` evaluates; `floor(buff.x.stack/2)` stays `unknown`

### Action Eligibility

- `target_if=talent.foo` is treated as a filter and can mark impossible
- `target_if=first:talent.foo` is treated as a filter and can mark impossible
- `target_if=min:talent.foo.rank` never marks impossible (ranking mode)
- `target_if=max:talent.foo.rank` never marks impossible (ranking mode)
- combined `if=talent.a&target_if=talent.b`: impossible if either evaluates `false`

### Graph

- `Off` mode produces the exact same nodes and edges as today (snapshot regression guard)
- `Dim` mode adds `talentState` to action and descendant nodes without removing any
- `Dim` mode dims the action-to-condition edges, not just the nodes
- `Hide` mode omits impossible actions and their subtrees
- `Hide` mode omits a block whose actions are all impossible and which is not referenced by a surviving `call_action_list`
- `Hide` mode keeps a target block visible if any surviving action targets it via `call_action_list`
- `Hide` mode does not keep a target block visible if its only invoker is itself hidden
- `Hide` mode omits a profile's root when no blocks survive
- `Hide` mode compacts vertical layout across removed blocks and profiles (no leftover whitespace)
- `Hide` mode populates `hiddenActionCount` per profile
- mode toggle Off → Hide → Off restores the original graph and the user's collapse state
- copy-with-talents-override: a copy that brings actions back renders normally even if the source profile is fully hidden
- determinism: same input + same mode produces identical coordinates
- empty-graph fallback: a document where every profile is hidden produces zero nodes and zero edges (placeholder is rendered by the canvas component, not the graph builder)

### E2E (Playwright)

- Preview shows the talent mode controls panel
- switching `Dim` / `Hide` changes graph behavior visibly
- `Hide` mode shows the empty-graph placeholder when everything is filtered
- Profile with no `talents=` line shows no warning and renders normally
- Profile with a malformed `talents=` line shows the warning and renders unfiltered
- Existing Write/Preview, collapse, parser error, and CodeMirror behavior are unaffected

### Verification

- `npm.cmd run lint`
- `npm.cmd run build`
- relevant Playwright suites: parser, build-graph, preview

## Failure Modes and User Messages

| Status                | UI treatment                                  |
|-----------------------|-----------------------------------------------|
| `absent`              | no message; render normally                   |
| `decoded`             | quiet success row, "<spec>: N talents loaded" (plus "M actions hidden" in Hide mode) |
| `unsupported_spec`    | warning, "no catalog for <class>/<spec>"      |
| `missing_catalog`     | warning, "talent catalog not loaded"          |
| `version_mismatch`    | warning, "talent tree changed; regenerate catalog" |
| `malformed_export`    | warning, "could not decode talents= string"   |

In every failure case, the graph still renders with no filtering applied for that profile. Failures never block the editor.

## Forward Compatibility

Talents are the first filter dimension, not the last. The architecture should make it cheap to add target count, consumables, gear, set bonuses, and similar dimensions later, and to exempt specific profiles ("inactive copies") from filtering so they remain visible for comparison.

Constraints v1 must respect to keep this open:

- the impossible-action set is computed by a small, replaceable step in the Hide pipeline. Adding a dimension means adding another contributor to that set, not changing the pipeline.
- `BuildGraphOptions` exposes `talentSelectionsByProfile` today; future dimensions will arrive as sibling options (e.g., `targetCountByProfile`, `consumablesByProfile`). Keep the field naming dimension-specific rather than renaming `talentSelectionsByProfile` to a generic `filtersByProfile`.
- per-profile activation will eventually be a separate concern from filtering. Reserve the idea: a profile flagged inactive is treated as if no filter applied to it, regardless of mode. v1 does not implement this flag, but the editor store and `buildGraph` should not assume "every profile is filtered" anywhere — the per-profile filtering loop already iterates profile-by-profile, so this falls out naturally as long as no global short-circuits are added.
- the decode-status panel should be ready to grow: today it shows per-profile talent rows; later it will show a row group per profile with one entry per active filter dimension. Build the panel as a list of profile sections rather than a flat list of talent rows.

None of this requires extra code in v1, but a reviewer should be able to look at the v1 architecture and see that adding "show inactive copies unfiltered" is a one-flag change rather than a refactor.

## Out Of Scope

- full talent-tree visualization
- live API calls of any kind
- profileset talent application
- variable-aware condition evaluation
- per-profile render mode selection
- evaluating `equipped.*`, `set_bonus.*`, gear-derived conditions
- target simulation or actor-wide runtime evaluation

## Open Questions

- should the catalog ship as one bundle (simpler) or per-class dynamic imports (smaller initial load)? Decide based on measured size after first generation
- should the badge on dimmed actions be a lock icon, a faded "off" pill, or a strikethrough on the action name
- should the empty-graph placeholder include a one-click "switch to Dim" button, or just a hint to use the panel
- should we provide an opt-in to apply the active profileset's talents to a profile in v1, even though full profileset UI is deferred
- when per-profile activation lands, where does the "active" flag live: on the document (parsed from a SimC convention), on derived editor state (user toggle in the panel), or both with the user toggle winning
