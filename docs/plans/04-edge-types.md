# Edge and Handle Types

Status: Accepted visual target; production tokens pending
Updated: 2026-08-17

Edges remain clean graph connections. AND/OR are labels on thin lines, not Lego
pieces, independently placed nodes, or buttons floating away from a condition.

## Edge Types

| Type | Color | Style | Direction | Meaning |
| --- | --- | --- | --- | --- |
| Ownership | Slate gray | Thin solid | Horizontal | Profile/block/action ownership; action stops at `IF` boundary |
| AND | Indigo | Thin solid + compact `AND` capsule | Horizontal | Boolean `&` relationship |
| OR | Violet | Thin solid + compact `OR` capsule | Vertical | Boolean `|` relationship |
| XOR | Muted slate until separately specified | Thin solid + `XOR` capsule | Vertical | Existing read-only `^` relationship |
| Draft | Operator color at reduced emphasis | Thin provisional line | AND/OR direction | Uncommitted connection to a draft condition |
| Deleting | Muted operator color/red state cue | Fading line and capsule | Existing direction | Preview of operand/operator cleanup |

Color is never the only cue. Operator text and horizontal/vertical orientation are
always present.

## Ownership Edges

Ownership is visually separate from boolean logic:

```text
[ACTION] -- ownership --> (IF boundary)  [condition graph inside]
```

- The action edge terminates at a round handle on the outer `IF` workspace.
- It does not continue to the first condition.
- Root/block/action ownership remains neutral slate gray.
- Internal AND/OR edges never cross the `IF` boundary.

## Condition Handles

Conditions expose two typed creation handles:

| Handle | Position | Hover/focus state | Activation |
| --- | --- | --- | --- |
| AND | Center-right | Enlarges and shows a centered `+` in indigo | Opens an AND draft to the right |
| OR | Center-bottom | Enlarges and shows a centered `+` in violet | Opens an OR draft below |

There is no detached `+ AND` or `+ OR` button. The add affordance appears inside
the handle where the connection will originate.

Accessible names and tooltips remain explicit:

```text
Add AND condition
Add OR condition
```

The visual circle may be compact, but the pointer/focus target should be larger
than the drawn handle. Handle focus must be visible without relying on color.

## Operator Connections

AND:

```text
[condition A] o------[ AND ]------o [condition B]
```

OR:

```text
[condition A]
       o
       |
     [ OR ]
       |
       o
[condition B]
```

The capsule is a small label centered on the edge. Cards retain comfortable space
around it; no operator box touches or interlocks with a condition.

Suggested token families to refine during implementation:

```text
AND: indigo (#4F6BD8 family)
OR:  violet (#8B5CF6 family)
Ownership: slate gray
```

Exact theme tokens must pass light/dark contrast checks before they are frozen.

## Draft State

Activating an add handle creates a provisional connection and a focused draft
condition card:

```text
[condition] o------[ AND ]------o [Choose condition...]
```

- The draft edge/capsule uses the chosen operator color with reduced emphasis.
- The draft card has focus and cancel affordances.
- Draft state is local UI state and does not enter APL text.
- Escape/cancel removes the draft and edge with no history entry.
- Commit replaces the provisional graph with the derived graph after one document
  operation.

## Deletion State

When deleting an operand would make an operator redundant, preview the operand,
edge, and capsule as one cleanup unit. The operation still targets the condition
operand; expression normalization decides whether the operator survives.

Examples:

```text
A & B      delete B -> A
A & B & C  delete B -> A & C
```

## Interaction Constraints

- No proximity-based auto-connect.
- No arbitrary edge drawing in the first graph-editing milestone.
- No cross-action or cross-`IF` condition connection.
- Unsupported targets do not highlight or accept a drop/click.
- Existing parse errors and inherited source lines make mutation handles read-only.
- Do not turn on global `nodesConnectable` as a shortcut for this workflow.

## Visual Reference

See [the accepted condition-builder board](../spikes/assets/001-condition-builder.png)
and [SPK-001](../spikes/001-node-visual-language.md).
