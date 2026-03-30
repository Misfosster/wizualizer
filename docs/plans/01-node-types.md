# Node Types

Custom React Flow node components for the structural APL graph.

## Summary

This phase adds 9 custom node types and wires them into the existing graph builder.
Condition expressions and variable values still render as single text leaves in this phase.

The graph currently uses a fixed left-to-right layout:

- Column 0: root profile node
- Column 1: block nodes
- Column 2: structural action nodes
- Column 3+: single condition/value leaves for now

Current grid metrics in the builder:

- Column width: 320px
- Row height: 80px

## Node Types

| Kind | Purpose | Key Data |
|------|---------|----------|
| `root` | Profile entry node | `label`, `blockCount`, `actionCount` |
| `block` | Action-list block such as `actions.precombat` | `label`, `actionCount`, `isCollapsed` |
| `action` | Default structural action | `label`, `hasCondition` |
| `variable` | `variable` / `cycling_variable` action | `label`, `variableName`, `op`, `valueText` |
| `useItem` | `use_item` / `use_items` action | `label`, `itemName`, `hasCondition` |
| `callActionList` | `call_action_list` / `run_action_list` action | `label`, `targetList` |
| `sequence` | `sequence` / `strict_sequence` action | `label`, `spells` |
| `condition` | Single condition-expression leaf | `label` |
| `valueExpression` | Single variable-value leaf | `label` |

Shared node data lives in `web/src/components/nodes/types.ts` so the graph builder and React Flow node components use the same discriminated union.

## Spell To Kind Mapping

Action node kind comes from `action.spell` in `build-graph.ts`:

- `variable`, `cycling_variable` -> `variable`
- `use_item`, `use_items` -> `useItem`
- `call_action_list`, `run_action_list` -> `callActionList`
- `sequence`, `strict_sequence` -> `sequence`
- everything else -> `action`

## Visual Language

- `RootNode`: neutral dark `#1f2937`
- `BlockNode`: slate/dark blue `#334155`
- `ActionNode`: dark gray `#374151`
- `VariableNode`: indigo gradient `#6366f1` to `#4f46e5`
- `UseItemNode`: pink/magenta gradient `#db2777` to `#be185d`
- `CallActionListNode`: teal gradient `#0d9488` to `#0f766e`
- `SequenceNode`: emerald gradient `#059669` to `#047857`
- `ConditionNode`: amber gradient `#f59e0b` to `#d97706`
- `ValueExpressionNode`: violet `#8b5cf6`

## Handle Placement

Default handle layout for all nodes:

- target handle on the left edge
- source handle on the right edge

`VariableNode` is the only exception. It has two source handles on the right side:

- `val`: upper handle for variable value expansion
- `if`: lower handle for variable condition expansion

In this phase both handles still point to single text leaves:

- `val` -> one `valueExpression` node
- `if` -> one `condition` node per `if` / `target_if` segment

## Current Scope

Implemented in this phase:

- custom React Flow components for all 9 node kinds
- typed node data in `web/src/components/nodes/types.ts`
- graph-builder extraction for variable metadata, action-list targets, and sequence spell lists
- purple `valueExpression` leaves for variables
- stable `nodeTypes` wiring in the canvas

Deferred to later phases:

- AND / OR condition tree expansion
- variable value tree expansion
- container nodes for explicit parentheses
- custom AND / OR edge types
- block collapse / expand behavior
- call-action-list linking to the destination block

## Future Layout Conventions

These are documented now but not implemented in this phase:

- AND (`&`) flows horizontally from left to right on the same row
- OR (`|`) branches vertically into separate rows
- value expression trees use the purple node/edge family
- condition trees use orange nodes with standard gray structural edges
