# Logiccraft — Design Patterns

## 1. Recursive Descent Parser

**Pattern**: Parse expressions by precedence chain, each level calls the next.

```typescript
// Precedence: | < & < comparisons < +- < */ < !
function parseOr(t: Tokenizer): Expression {
  let left = parseAnd(t);
  while (t.peekValue('|')) {
    t.next();
    const right = parseAnd(t);
    left = { kind: 'BinaryExpression', operator: '|', left, right };
  }
  return left;
}

function parseAnd(t: Tokenizer): Expression {
  let left = parseComparison(t);
  while (t.peekValue('&')) { /* ... */ }
  return left;
}
// ... continues through precedence chain
```

**Key insight**: Each function handles one operator level, delegates to higher precedence.

---

## 2. Builder/Accumulator Pattern

**Pattern**: Build output by accumulating into arrays passed as parameters.

```typescript
function buildSugiyamaLayeredDAG(ast: AplDocumentAst) {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let nodeId = 0, edgeId = 0;
  
  // Accumulate nodes and edges
  for (const block of ast) {
    nodes.push(createBlockNode(...));
    edges.push(createEdge(...));
    
    for (const action of block.actions) {
      if (action.condition) {
        const result = buildConditionTree(..., nodes, edges, nodeId, edgeId);
        nodeId = result.nodeId;
        edgeId = result.edgeId;
      }
    }
  }
  
  return { nodes, edges };
}
```

**Why**: Separates construction from representation, easy to extend.

---

## 3. Pure Functions for Layout

**Pattern**: All layout calculations are deterministic, side-effect free.

```typescript
// Same input always produces same output
function gridPoint(column: number, row: number): { x: number; y: number } {
  return {
    x: column * GRID_METRICS.columnWidth,  // 320
    y: row * GRID_METRICS.rowHeight,       // 120
  };
}

// No mutation of input
function flattenAndExpressions(expr: Expression): Expression[] {
  if (expr.kind === 'BinaryExpression' && expr.operator === '&') {
    return [...flattenAndExpressions(expr.left), ...flattenAndExpressions(expr.right)];
  }
  return [expr];
}
```

**Benefits**: Testable, memoizable, predictable.

---

## 4. Result Type for Fallible Operations

**Pattern**: Return success/failure instead of throwing.

```typescript
type ApplyResult =
  | { ok: true; ast: AplDocumentAst; canonicalText: string }
  | { ok: false; error: string; lastGoodText: string };

function applyFullText(text: string): ApplyResult {
  const parsed = this.tryParse(text);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, lastGoodText: this.lastGoodText };
  }
  // ... success path
  return { ok: true, ast: this.ast, canonicalText: this.canonicalText };
}
```

**Why**: Enables last-good fallback without exceptions.

---

## 5. Composite ID Pattern

**Pattern**: Encode hierarchy in ID strings for easy parsing.

```typescript
// Action IDs encode block + index
const actionId = `action__${blockName}__${index}`;
// e.g., "action__actions.cds__2"

// Parse when needed
function parseActionId(actionId: string) {
  const [, blockName, indexStr] = actionId.split('__');
  return { blockName, actionIndex: Number(indexStr) };
}
```

**Why**: Enables O(1) lookup without maintaining separate maps.

---

## 6. OR Sequential Chaining

**Pattern**: OR branches chain A→B→C, not A→B and A→C in parallel.

```
[A] ←─ First branch (standard edge from parent)
 |
 | OR
 v
[B] ←─ Second branch (OR edge from A)
 |
 | OR
 v
[C] ←─ Third branch (OR edge from B)
```

**Why nested expressions work**: For `(A1|A2)|B`, B connects to A2 (last sub-branch), not A1.

**Implementation**: Track `previousBranchFirstCondition` and `lastBranchFirstCondition` through recursion.

---

## 7. Memoized Component References

**Pattern**: Define node/edge types outside component to avoid recreating on each render.

```typescript
// ❌ Bad: Creates new object every render
function EditorCanvas() {
  const nodeTypes = { root: RootNode, block: BlockNode, ... };
  return <ReactFlow nodeTypes={nodeTypes} />;
}

// ✅ Good: Stable reference
const nodeTypes = {
  root: RootNode,
  block: BlockNode,
  action: ActionNode,
  condition: ConditionNode,
} as const;

function EditorCanvas() {
  return <ReactFlow nodeTypes={nodeTypes} />;
}
```

**Why**: React Flow re-renders all nodes when `nodeTypes` reference changes.

---

## 8. Precedence-Aware Printing

**Pattern**: Track parent precedence to decide when parentheses are needed.

```typescript
function printExpr(e: Expression, parentPrec = 0): string {
  switch (e.kind) {
    case 'BinaryExpression': {
      const prec = e.operator === '&' ? 2 : 1;  // & binds tighter than |
      const s = `${printExpr(e.left, prec)}${e.operator}${printExpr(e.right, prec)}`;
      return prec < parentPrec ? `(${s})` : s;  // Wrap if lower precedence
    }
    case 'GroupExpression':
      return `(${printExpr(e.expression, 0)})`;  // Always wrap
    // ...
  }
}
```

**Why**: Minimal parentheses while preserving semantics.

---

## 9. Selection Sync Pattern

**Pattern**: Bidirectional sync between tree and canvas selection.

```typescript
// Explorer → Canvas
function handleNodeClick(node) {
  setSelectedActionId(node.id);
  onSelectAction(node.id);  // Callback to parent
}

// Canvas → Explorer (in EditorCanvas)
useEffect(() => {
  if (selectedActionId) {
    const node = nodes.find(n => n.id === selectedActionId);
    if (node) {
      reactFlowInstance.fitView({ nodes: [node], duration: 300 });
    }
  }
}, [selectedActionId]);
```

**Why**: User can navigate from either view.

---

## 10. Drag Payload Protocol

**Pattern**: Encode drag data in dataTransfer with namespaced MIME type.

```typescript
// On drag start
e.dataTransfer.setData('application/x-apl-action', JSON.stringify({
  actionId,
  fromBlock,
  fromIndex
}));

// On drop
const payload = JSON.parse(e.dataTransfer.getData('application/x-apl-action'));
if (payload) {
  onReorderAction(payload.actionId, targetBlock, targetIndex);
}
```

**Why**: Prevents conflicts with other drag sources, enables rich payloads.
