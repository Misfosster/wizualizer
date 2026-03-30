# Variable Jump-To

Add variable reference navigation to the graph so users can jump from a variable use to the variable node that defines it.

## Recommendation

This is a good idea.

A graph search or filter is still useful, but it does not replace jump-to:

- jump-to answers "where does this variable come from?" in one action
- search/filter answers "show me all places related to this variable"
- conditions become much easier to read when variable references are visually distinct and navigable

Recommendation: implement jump-to first, then add a graph search/filter as a complementary tool later.

## UX Goals

- variable references inside future condition/value renderers should appear in bold uppercase
- clicking a variable reference should jump the viewport to the variable node that defines it
- a small action button on condition/value nodes can provide the same jump behavior when inline rendering is not available yet
- if the target variable lives inside a collapsed block, that block should expand before the viewport jumps
- unresolved variable references should stay visible but use a non-interactive fallback style

## Expected Behavior

### Direct Jump

- clicking `AOE_THRESHOLD` in a condition should locate the matching `variable` node
- the graph should center or fit the target node into view
- the target node should receive a temporary highlight so the user can see where the jump landed

### Multiple Definitions

Variables may be defined more than once.

Default rule:

- jump to the nearest valid definition that appears earlier in graph order within the same profile

Future refinement:

- if multiple earlier definitions exist and ambiguity matters, offer a small chooser popover

### Collapsed Blocks

- if the target variable node is hidden by a collapsed block, expand that block first
- the jump should happen after the graph state updates

## Scope

### Phase 1

Works with the current single-text condition/value leaves.

- add variable definition indexing during graph build or derived-state construction
- attach variable-definition metadata to graph nodes
- add a jump action button on variable-related condition/value nodes
- jump to the resolved variable definition node
- auto-expand collapsed blocks before jumping
- apply a temporary "jump target" highlight style

### Phase 2

Works once condition/value nodes stop rendering as plain text strings.

- tokenize condition/value expressions into presentational parts
- render variable references as bold uppercase interactive tokens
- allow click-on-name jump directly from the inline token
- preserve normal text rendering for operators, numbers, and built-in identifiers

## Data Model

Likely additions:

- a variable definition index keyed by profile and variable name
- node data for `condition` and `valueExpression` that can optionally carry resolved variable references
- a small navigation state in the editor store for the currently highlighted jump target

Possible types:

```ts
interface VariableDefinitionRef {
  variableName: string;
  nodeId: string;
  blockId: string;
  profileIndex: number;
  actionIndex: number;
}

interface VariableReferenceToken {
  kind: "text" | "variable";
  text: string;
  variableName?: string;
  targetNodeId?: string;
}
```

## Implementation Outline

### 1. Build A Definition Index

- scan all `variable` and `cycling_variable` actions in graph order
- record their node ids and block ids
- resolve later uses against the nearest earlier definition in the same profile

### 2. Expose Jump Metadata

- include resolved variable-target metadata on expression nodes or tokens
- keep unresolved names explicit rather than hiding them

### 3. Add Navigation Actions

- add a store action such as `jumpToNode(nodeId)`
- expand the target block if needed
- wait for the graph to rebuild if expansion occurred
- use the React Flow instance to center or fit the target node

### 4. Add Visual Feedback

- add a temporary target highlight class on the jumped-to node
- add hover/active styling for clickable variable references
- use a non-clickable muted warning style for unresolved variable names

## Rendering Rules

When inline token rendering exists:

- variable references render as bold uppercase text
- clickable references use pointer cursor and hover affordance
- unresolved references still render as bold uppercase, but without click behavior

Before inline token rendering exists:

- keep the current plain-text label
- add a compact "jump" action only when the expression resolves to one or more variable references

## Testing

- graph-builder tests for definition indexing and nearest-earlier-definition resolution
- store tests for auto-expanding a collapsed target block before jump
- preview e2e tests for jump button behavior
- preview e2e tests for inline variable token navigation once rich condition rendering exists
- tests for unresolved references and multiply defined variables

## Out Of Scope

- global graph search or filtering UI
- drawing special edges from variable uses back to definitions
- cross-profile jump behavior
- ambiguity chooser UI for the first pass

## Open Questions

- should built-in identifiers be visually distinct from user-defined variables, or only user-defined variables
- should jump center the node, fit the local neighborhood, or briefly zoom in
- should repeated jumps maintain a back-stack
- should the first version support only `if` conditions, or also variable value expressions and future container nodes
