# Wizualizer - Overview

## Goal

Build a visual editor for APL that preserves a canonical text format while enabling
fast, reliable edits from text, tree, and graph interfaces.

## Scope (Initial)

- Single-user, local editing
- Browser-based UI
- Canonical APL text as source of truth
- Graph editing as a first-class editor
- Deterministic layout with stable positions

## Out of Scope (Initial)

- Collaboration/multi-user
- Server-side persistence
- Plugin system

## Success Criteria

- Round-trip safety: text ↔ AST ↔ graph produces equivalent APL
- Graph edits are expressive enough to build and modify real APLs
- No data loss on parse errors (last-good fallback)

## Related Docs

- `docs/04-ROADMAP.md`
- `docs/05-GRAPH-FEATURE.md`
- `docs/DECISIONS.md`
- `docs/plans/11-graph-editing.md`
- `docs/spikes/001-node-visual-language.md`
