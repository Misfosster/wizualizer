# SPK-001 - Node visual language

Status: Accepted
Owner: William
Target milestone: Graph editing
Timebox: One sketch/review cycle followed by one focused refinement cycle
Decision needed by: Before graph-editing UI implementation begins

## Context

The current graph is functional but visually futuristic and comparatively noisy.
Graph editing will add controls and interaction states, so its node anatomy and
visual hierarchy should be simplified before those behaviors harden around the
existing presentation.

## Question

What simpler, more colorful, and more clearly defined visual language makes APL
nodes easy to scan while leaving enough room for editing affordances?

## Constraints and non-goals

- Preserve the existing semantic node categories and deterministic graph layout.
- Color should communicate category or state consistently, not act as decoration.
- Labels and conditions must remain readable at ordinary canvas zoom levels.
- Selected, hovered, collapsed, disabled/impossible, warning, and resolved states
  need recognizable treatments.
- Support light and dark themes with accessible contrast and non-color cues.
- Do not redesign the overall editor shell or implement graph editing in this spike.
- Do not assume free-form connectors until their editing semantics are defined.

## Selected direction

Use soft semantic cards inside action-owned `IF` workspaces. Conditions behave
like fast connection anchors. Hovering the right or bottom handle enlarges that
handle and reveals a centered `+` inside it; there is no detached add button. The
right handle creates `AND`, while the bottom handle creates `OR`, with tooltips and
accessible labels making that mapping explicit. Activating either handle creates
a thin operator-labeled connection and a focused draft condition. `AND` uses
indigo and stays horizontal; `OR` uses violet and stays vertical, with labels and
orientation preserving meaning without color. A faint editing-time grid helps the
graph grow in both directions without implying connections by proximity.

The draft condition is a canvas overlay until it contains a valid expression.
Canceling removes the draft without changing the document. Committing creates one
document operation, while deleting an operand normalizes away any operator that no
longer has enough operands.

Logical containers remain derived structure rather than palette nodes. Adding a
mixed operator materializes any scope needed by the resulting expression.
Marquee-driven grouping remains a secondary restructuring action: when wrapping a
selection would have no logical effect, its provisional container is muted and
the action explains why it is disabled.

## Experiment

Create one focused interaction board showing:

- action-owned condition workspaces with room to grow in both dimensions;
- hover affordances for adding `AND` and `OR` from a condition handle;
- a temporary connected draft condition and its commit state;
- automatic logical-container materialization for mixed operators;
- deletion of an operand and its now-redundant connector; and
- edge, handle, focus, deletion, and container treatments.

## Sketches

- [Current node view](assets/001-current-node-view.png) - captured baseline.
- [Authoritative structure reference](assets/001-structure-reference.png) - the
  same real graph with canvas panels removed.
- [Accepted condition-builder direction](assets/001-condition-builder.png) -
  handle-driven condition creation, clean operator-labeled connections, automatic
  scope, and deletion cleanup.

## Evidence and findings

The baseline confirms that gradients, deep shadows, low-contrast dark surfaces,
small uppercase metadata, and glow-like state treatments create much of the
current futuristic tone. Pale semantic fills, clear outlines, dark text, and
colored handles make node categories readable without saturated headers.

An action edge terminates at its neutral `IF` workspace boundary. Conditions are
owned by that workspace and connect through round handles and thin edges. A small
indigo `AND` capsule labels horizontal connections; a violet `OR` capsule labels
vertical connections. The workspace provides at least a two-by-two logical area
and expands by rows or columns, with subtle editing-time alignment guides that do
not create graph edges.

Creating an operator and its empty operand together is faster than placing either
from a palette. Keeping the empty card as a draft avoids invalid APL text. When an
operand is removed, expression normalization also removes a unary operator and any
container that has become redundant.

Containers visualize meaningful logical scope; they are not independently placed
nodes. A marquee is a discoverable way to request grouping without bypassing the
expression model. The preview is an overlay until a valid graph intent updates
the document and the graph rebuild derives the real container. Redundant
parentheses continue to elide their container, so their preview and `Group` action
are disabled with an explicit `No logical effect` explanation.

## Recommendation

Use the accepted condition-builder direction as the visual and interaction basis
for the graph-editing spike. Keep connectors explicit, keep workspaces
two-dimensional, and derive logical containers from document structure.

## Decision

Accepted on 2026-08-17 by William. Proceed with soft semantic cards, action-owned
`IF` workspaces, handle-driven operator connections, transient condition drafts,
derived logical containers, and automatic deletion cleanup.

## Follow-up

- Use [the graph-editing implementation plan](../plans/11-graph-editing.md) as the
  production handoff.
- Run [SPK-002](002-graph-mutation-boundary.md) before enabling canvas mutations.
- Convert the accepted direction into exact theme tokens and the remaining
  representative node-state specs.
- Prove draft/history, deletion normalization, and secondary grouping through the
  accepted mutation boundary.
