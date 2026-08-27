# Condition Workspaces and Logical Containers

Status: Accepted visual behavior; editing operations pending
Updated: 2026-08-27

Two different boundaries appear around conditions and must not be conflated:

1. An action-owned `IF` workspace establishes ownership and editing room.
2. A logical container visualizes meaningful expression scope.

Neither is a freely placed palette node or an independently persisted canvas
object.

A future **Condition Group** is a third, separate concept: a tree-level authoring
group that applies one inherited condition to ordered actions and nested groups.
It is tracked as later work in [the graph-editing plan](11-graph-editing.md) and is
not represented by the expression containers described below.

## Action-Owned `IF` Workspace

Every conditioned action owns one neutral `IF` workspace:

```text
[ACTION] --> (IF boundary)  [condition expression]
```

- The action ownership edge stops at the workspace's left boundary handle.
- All condition nodes and logical containers for that condition are children of
  the workspace for layout/interaction purposes.
- The workspace is not an AST operator and does not print parentheses.
- It reserves visible horizontal and vertical growth room: at least a two-by-two
  logical area for a small expression.
- It expands by rows or columns while keeping deterministic layout.
- A faint editing-time alignment grid may appear, but grid adjacency never creates
  an edge.

## Logical Containers

A logical container is a neutral dashed visual group derived when scope needs to
be visible:

- explicit logical parentheses change grouping;
- a mixed-precedence branch needs to read as one operand;
- an AND branch is contested inside OR/XOR;
- nested logical groups need visible scope.

Containers are elided when they add no clarity:

- redundant outer parentheses around a pure root AND/OR chain;
- parentheses around one comparison;
- arithmetic-only parentheses inside an atomic comparison;
- a group already made unambiguous by the surrounding derived structure.

The current implementation's elision rules in `condition-layout.ts` remain the
source of truth until an editing operation deliberately changes them.

## Planned Condition Groups Are Different

Logical containers explain parentheses and operator scope inside one action's
condition expression. Planned Condition Groups instead contain actions in a
priority tree. Their parent conditions are inherited by descendants and flattened
into each emitted action's `if=` expression.

Condition Groups must therefore remain distinct from both logical containers and
actual SimC `call_action_list` / `run_action_list` constructs. Reordering their
children changes the depth-first emitted order and may change action priority;
the UI should present that result directly rather than preserve old positions in
hidden metadata.

## Visual Style

- Neutral gray dashed border.
- Very light neutral background distinct from the outer `IF` workspace.
- Rounded corners matching the card system.
- Generous padding on all sides.
- Automatic size based on children plus minimum useful interior space.
- No collapse button in the first graph-editing milestone.
- Nesting is communicated by boundary depth/spacing, not a rainbow of unrelated
  semantic colors.

## Layout Rules

| Expression | Visual layout |
| --- | --- |
| `a` | One condition in the `IF` workspace |
| `a&b&c` | Horizontal AND connections, no logical container |
| `a|b|c` | Vertical OR connections, no logical container |
| `a&b|c` | AND branch container where needed to show it as one OR operand |
| `(a|b)&c` | Container around the vertical OR branch, then AND to `c` |
| Redundant `(a|b)` at root | Vertical OR chain; outer container elided |

## Creation

Logical containers normally materialize as a consequence of an expression edit:

```text
A & B
click Add OR on B
commit C
-> A & (B | C)
```

The mutation changes the expression; the graph rebuild derives the required
container. Canvas code must not create a React Flow parent first and then attempt
to infer APL from it.

Marquee grouping is a secondary restructuring action:

- selected nodes must belong to one `IF` workspace;
- selection must represent a complete connected expression subtree;
- the provisional boundary is an overlay until the document operation commits;
- a redundant/no-op group remains visible as a muted preview with an explanation;
- no generic container item appears in the palette.

## Removal and Normalization

There is no unconditional visual `Ungroup` that merely deletes a box. Removing a
meaningful container means changing expression structure.

Deleting an operand may make a group redundant:

```text
A & (B | C)  delete C -> A & B
```

The operation promotes the surviving operand, prints valid precedence, and lets
the graph rebuild remove the obsolete OR connection and container.

Same-operator groups may be flattened when semantically safe. Mixed-precedence
groups require an explicit restructure operation or moving operands; they must not
silently change meaning behind an `Ungroup` label.

## AST and Graph Mapping

The mapping is intentionally not one-to-one:

| Document structure | Graph result |
| --- | --- |
| Meaningful `paren` expression | Logical container |
| Redundant/elided `paren` expression | No extra visual container |
| Contested AND branch | Derived logical container even without explicit outer parentheses |
| Action condition segment | One outer `IF` workspace |

Graph nodes remain derived. Graph edits update the source/document operation
model, print valid action/condition text, and rebuild containers from the result.

## Test Requirements

- Pure root AND and OR chains have no logical container.
- Meaningful explicit grouping remains visible and prints with correct precedence.
- Redundant parentheses remain semantically safe when their container is elided.
- Adding a mixed operator derives the expected container.
- Deleting an operand removes only the now-redundant operator/container.
- Workspace ownership never leaks across actions.
- Container bounds and child positions remain deterministic.

## Visual Reference

See [the accepted condition-builder board](../spikes/assets/001-condition-builder.png)
and [SPK-001](../spikes/001-node-visual-language.md).
