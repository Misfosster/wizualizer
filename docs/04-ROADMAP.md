# Wizualizer - Roadmap

## Phase 1: Foundations

- Graph editing support (structural edits)
- GroupExpression preservation via Group nodes
- Graph→APL export re-enabled
- UI stack baseline: Radix UI + Tailwind

## Phase 2: Correctness

- Semantic validation (unknown refs, type mismatches)
- Deterministic graph layout tests
- Robust import/export UX

## Phase 3: Experience

- Container node grouping (parent nodes)
- Undo/redo history
- Profileset management UI

## Specs (Spec-Driven Development)

### Spec 01 — Canonical Text

- All edits flow through canonical APL text
- Users can directly edit text; AST reprints canonical form
- Invalid edits never corrupt working state
- Last-good fallback is always recoverable

### Spec 02 — Graph Editing

- Users can add/remove/reorder actions via graph
- Users can connect/disconnect conditions via graph
- Freeform repositioning is allowed when it preserves syntax and semantics
- Repositioning can change action order, and updates canonical APL text
- Graph edits map to AST operations without lossy transforms

### Spec 03 — GroupExpression

- Parentheses are preserved through graph round-trips
- Group nodes render only when parentheses exist
- `(a|b)&c` round-trips to `(a|b)&c`

### Spec 04 — Import/Export

- Export produces a canonical, stable APL string
- Import parses APL and renders a stable graph layout
- Import failures preserve last-good state and report errors

### Spec 05 — Validation

- Unknown references are flagged in UI
- Type mismatch warnings are surfaced inline
- Validation never blocks editing or export, only informs

### Spec 06 — Layout Determinism

- Same APL input yields the same node coordinates
- AND/OR layout rules are consistent across sessions
- Layout changes are versioned if rules evolve
