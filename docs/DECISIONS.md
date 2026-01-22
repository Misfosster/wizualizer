# Logiccraft — Decisions

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
