# Logiccraft — Decisions

Record architecture and stack decisions with short context and rationale.

## 2025-01-01 — UI Stack

- Decision: Use Radix UI + Tailwind for UI primitives and styling.
- Context: BlueprintJS is not React 19 compatible and is heavier than needed.
- Rationale: Headless components with full styling control and React 19 support.
- Status: Accepted.

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
