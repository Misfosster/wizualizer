# Logiccraft — Architecture Summary

## Core Data Flow

```
APL Text → parseDocument() → AplDocument → buildGraph() → React Flow Graph
    ↑                                                          ↓
    └──────────── printApl() ←── AplDocumentManager ←──────────┘
                               ↑
                graph edits →  │
```

## Key Architectural Decisions

### 1. Single Canonical APL String
- One source of truth: the APL text string
- **Last-good fallback**: On parse error, keep previous valid state
- Never let invalid edits corrupt the working state

### 2. Explorer/Inspector/Graph = Editors
- Graph canvas supports **direct edits** (add/remove/reorder/connect)
- Explorer and Inspector remain first-class editing surfaces
- All edits flow through AplDocumentManager → AST → regenerate graph

### 3. AplDocumentManager Handles All Mutations
```typescript
class AplDocumentManager {
  // State
  private canonicalText: string;
  private lastGoodText: string;
  private ast: AplDocumentAst;
  
  // Operations (all return ApplyResult)
  addBlock(name) / deleteBlock(name) / renameBlock(old, new)
  addAction(block, name) / deleteAction(id) / reorderAction(id, target, idx)
  applyFullText(text) / applyActionText(id, text) / applyBlockText(name, text)
}

type ApplyResult = 
  | { ok: true; ast; canonicalText }
  | { ok: false; error; lastGoodText };
```

### 4. Graph Mutations Are AST-First
- Graph edits are translated into AST operations (or AST patches)
- APL text is reprinted from AST to keep a canonical, shareable format
- Guardrails keep round-trip stable, including GroupExpression nodes

### 5. Graph Editing Rules (Initial)
- Graph edits are structural (add/remove/reorder/connect); text edits stay in Inspector
- Connections map to AST relationships (block → action → condition)
- Any invalid edit is rejected with last-good fallback, same as text edits

### 6. Zustand Store Mirrors AST for UI
- Store holds `blocks[]` derived from AST via `setBlocksFromAst()`
- Selection state: `selectedActionId`, `selectedBlockName`, `selectedNodeText`
- Components subscribe to store slices they need

## Module Structure

```
web/src/
├── utils/apl-parser/         # Core APL handling
│   ├── document.ts            # parseDocument() → AplDocument
│   ├── types.ts               # Action, Segment, Condition AST types
│   ├── pretty-log.ts          # prettyCond() expression printer
│   ├── grid-layout.ts         # GridLane, gridPoint(), LANE_WIDTH, ROW_HEIGHT
│   └── build-graph.ts         # buildGraph() → React Flow nodes & edges
├── components/nodes/          # Custom React Flow node components + types
├── state/
│   └── editorStore.ts         # Zustand store (collapsedBlocks, APL text)
└── App.tsx                    # Root layout with canvas + input tabs
```

## UI Stack

- React 19 + TypeScript
- React Flow for graph canvas
- shadcn/ui + Tailwind for UI components (built on Radix primitives)
- react-arborist for explorer tree
- Zustand for state management
- Vite for dev/build
- Playwright for E2E tests

## Grid Layout System

| Column | Content |
|--------|---------|
| 0 | Root node ("Actions") |
| 1 | Block nodes (Precombat, Main, CDs, Finish) |
| 2 | Action nodes |
| 3+ | Condition nodes |

**Grid metrics**: `LANE_WIDTH = 400px`, `ROW_HEIGHT = 120px` (see `grid-layout.ts`)

**Semantic lanes**: root (0), block (1), action (2), expression (3+)

**Layout**: `gridPoint(lane, row)` maps each node to `{ x: laneIndex * 320, y: row * 80 }`

## Edge Types

| Type | Color | Style | Meaning |
|------|-------|-------|---------|
| `standard` | Gray | Solid | Parent→child (block→action, action→condition) |
| `and` | Blue | Dashed | Horizontal AND chain |
| `or` | Orange | Dashed | Vertical OR branch |
| `variable` | Purple | Solid | Variable assignment |

## Known Limitation: GroupExpression

**Problem**: Parentheses like `(a|b)&c` are NOT preserved through graph round-trips.
- Parser captures them as `GroupExpression`
- `astToGraph` strips them (unwraps the inner expression)
- `graphToAst` can't recreate them

**Result**: `(a|b)&c` becomes `a|b&c` (different precedence!)

**Solution**: Store GroupExpression as graph nodes and preserve them in graph↔AST conversions

## What's Not Built

- Graph→APL export (disabled)
- Graph editing toolbar (disabled)
- RuleBuilder visual condition editor
- Semantic validation (unknown refs, type mismatches)
- Profileset management UI
