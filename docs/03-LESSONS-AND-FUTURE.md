# Logiccraft — Lessons Learned & Future Work

## What Worked Well

### 1. Single Source of Truth (APL Text)
- Never had state sync issues between text/AST/graph
- Last-good fallback prevented data loss on parse errors
- Easy to debug: just look at the canonical text

### 2. Deterministic Grid Layout
- Same APL always produces same visual layout
- No "jitter" or unpredictable positioning
- Easy to write visual tests against specific positions

### 3. Parser with Precedence Chain
- Clean recursive descent handles complex nesting
- Adding new operators is straightforward
- Printer mirrors parser structure (easy to maintain both)

### 4. Explorer as Primary Editor
- Drag-and-drop reordering is intuitive
- Tree structure matches mental model of APL
- Text editing in Inspector gives power users control

### 5. React Flow v12
- Handles large graphs well (100+ nodes at 60fps)
- Custom node/edge components are flexible
- Built-in pan/zoom/minimap saved development time

---

## What Didn't Work / Lessons Learned

### 1. Graph Editing Was Deprioritized
**Original plan**: Edit graph visually, export to APL.
**Reality**: Graph→AST conversion was lossy (GroupExpression).
**Lesson**: Round-trip fidelity is hard. It must be solved, not avoided.

### 2. GroupExpression Complexity
**Problem**: `(a|b)&c` loses parentheses through graph.
**Why it's hard**: Graph represents semantic structure, not syntactic.
**Solution (not implemented)**: Store GroupExpression as explicit graph nodes.

### 3. RuleBuilder Overhead
**Original plan**: Visual query builder for conditions.
**Reality**: Text editing is often faster for power users.
**Lesson**: Don't over-invest in visual editors before validating need.

### 4. Too Many Documentation Files
**Problem**: 50+ markdown files, many outdated/duplicate.
**Lesson**: Start with fewer, more focused docs. Update or delete, don't accumulate.

### 5. Layout System Complexity
**Problem**: 1300+ lines for layout calculations.
**Why**: OR/AND nesting, collision handling, group boundaries.
**Lesson**: Layout is genuinely complex. Accept it, but modularize well.

---

## Future Work Priorities

### High Priority

1. **Graph Editing + GroupExpression Preservation**
   - Add `Group` node type to graph model
   - Modify `astToGraph` to emit Group nodes
   - Modify `graphToAst` to recreate GroupExpression
   - Test round-trip: `(a|b)&c` → graph → `(a|b)&c`
   - Enable structural edits in graph (add/remove/reorder/connect)

2. **Graph→APL Export**
   - Re-enable export button
   - Ensure action ordering from Y-positions
   - Handle edge cases (disconnected nodes, etc.)

3. **Semantic Validation**
   - Flag unknown references (e.g., `buff.typo.up`)
   - Type checking (comparing string to number)
   - Wire validators to lint panel UI

### Medium Priority

4. **Container Node Grouping** (Vision Doc)
   - Replace overlay boxes with React Flow parent nodes
   - Groups become selectable/interactive
   - Better visual clarity for nested expressions

5. **Import/Export UX**
   - Modal with copy-to-clipboard
   - Download as .simc file
   - Paste detection (auto-parse on paste)

### Lower Priority

6. **RuleBuilder Condition Editor**
   - Visual builder for `if=` conditions
   - Autocomplete for references
   - Only if validated by user research

7. **Profileset Management**
   - UI to create/switch/compare profiles
   - Data model exists, just needs UI

8. **Undo/Redo**
   - History stack for AST changes
   - Zustand middleware or custom implementation

---

## Technology Choices Worth Keeping

| Choice | Why It Worked |
|--------|---------------|
| **React + TypeScript** | Type safety caught many bugs early |
| **React Flow v12** | Best graph library, good performance |
| **Zustand** | Simple, no boilerplate, works with React 19 |
| **Radix UI + Tailwind** | Headless, React 19-friendly, and easy to theme |
| **Vite** | Fast dev server, simple config |
| **Playwright** | Reliable E2E tests, good debugging |

---

## Questions for the Rewrite

1. **Is graph editing essential?** If not, keep canvas as visualization-only (much simpler).

2. **How important is GroupExpression?** If APLs rarely use explicit parentheses, maybe skip it.

3. **Who is the primary user?** Power users want text editing. Beginners want visual guidance.

4. **What's the deployment target?** Browser-only? Electron? Impacts persistence strategy.

5. **Multi-user/collaboration?** Affects state management significantly.

---

## Key Files to Study

| Concept | File |
|---------|------|
| Parser structure | `src/apl/parser.ts` |
| AST types | `src/apl/ast.ts` |
| State management | `src/apl/AplDocumentManager.ts` |
| Layout algorithm | `src/layout/buildGraph.ts` |
| Condition tree | `src/layout/conditionTree.ts` |
| React Flow setup | `src/features/editor/EditorCanvas.tsx` |
| Explorer tree | `src/features/editor/ExplorerTree.tsx` |

---

## One-Line Summary

> **A visual APL editor that treats text as canonical, supports edits from graph/Explorer/Inspector, and preserves explicit parentheses through round-trips.**
