# Wizualizer - Decisions

Record architecture and stack decisions with short context and rationale.

## 2025-01-01 — UI Stack (Updated 2026-01)

- Decision: Use shadcn/ui + Tailwind for UI components, react-arborist for explorer tree.
- Context: Originally chose raw Radix UI. shadcn/ui provides pre-styled Radix components with full customization (code is copied into your repo).
- Rationale: Best of both worlds - Radix accessibility + beautiful defaults + owned code. react-arborist handles tree complexity (keyboard nav, drag-drop, virtualization).
- Status: Accepted (supersedes raw Radix).

## 2025-01-01 — Canonical Text and Graph Repositioning

- Decision: Allow direct text edits; graph repositioning can reorder actions when valid.
- Context: Users need text control and intuitive graph manipulation.
- Rationale: Text remains canonical while graph provides ergonomic structure changes.
- Status: Accepted.

## 2025-01-01 — APL Metadata/Versioning

- Decision: No embedded metadata/version markers in APL text for now.
- Context: The APL text is edited directly and should remain pure APL.
- Rationale: Avoids introducing non-APL lines until a concrete need emerges.
- Status: Accepted.

## 2026-08-17 - Graph Editing Visual and Interaction Direction

- Decision: Use soft semantic cards inside action-owned `IF` workspaces. A
  condition's right and bottom handles reveal an in-handle `+` for AND and OR.
  Activating a handle creates a clean operator-labeled connection and transient
  draft condition. Logical containers are derived from meaningful expression
  scope, and deleting an operand normalizes redundant operators/containers away.
- Context: Graph editing needs a fast construction workflow that preserves the
  existing horizontal AND, vertical OR, deterministic layout, and canonical-text
  ownership model without free-form or proximity-based connections.
- Rationale: Direct handle creation removes palette round trips, keeps the add
  affordance at its origin, prevents empty conditions from entering APL text, and
  leaves React Flow nodes as derived state.
- Consequences: The draft lives only in canvas UI state; commit must cross a tested
  document/text mutation boundary; cancel creates no history entry; marquee
  grouping is secondary; containers never become independent palette nodes.
- References: `docs/spikes/001-node-visual-language.md`,
  `docs/spikes/assets/001-condition-builder.png`, and
  `docs/plans/11-graph-editing.md`.
- Status: Accepted.
