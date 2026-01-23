# Edge Types

Edges connect nodes in the graph canvas. Three types with distinct styling.

## Edge Types

| Type | Color | Style | Direction | Use Case |
|------|-------|-------|-----------|----------|
| Standard | Gray | Solid | Horizontal | Parent→child connections |
| AND | Blue | Dashed | Horizontal | Conditions chained by `&` |
| OR | Orange | Dashed | Vertical | Conditions separated by `\|` |

## Standard Edges

Plain gray solid lines for structural parent→child relationships:

- Root → Folder (from bottom of Root, flows down then right)
- Root → Root-level Action (from bottom of Root)
- Folder → Action (from bottom of Folder, flows down then right)
- Action → first Condition/Container (horizontal, right side)

**Style**:
```typescript
{ stroke: '#6b7280', strokeWidth: 1.5 }  // gray-500
```

**Root handle placement**: RootNode uses a bottom handle so edges flow downward, then branch right to column 1 items (which are stacked vertically):

```
Root (col 0)
  │
  │ (down)
  │
  ├───► Folder: precombat
  │
  ├───► Folder: cds
  │
  ├───► Action: auto_attack
  │
  └───► Action: rupture
        
        (col 1, stacked vertically)
```

This prevents edges from crossing through the column 1 nodes.

**Folder handle placement**: FolderNode also uses a bottom handle, signifying "going down a level":

```
Folder: precombat (col 1)
  │
  │ (down into folder)
  │
  ├───► Action: flask (col 2)
  │
  ├───► Action: potion
  │
  └───► Action: augment
```

## AND Edges

Blue dashed lines for horizontal AND chains:

```
Cond: targets>=2 ──AND──> Cond: mark ──AND──> Cond: dance
```

**Style**:
```typescript
{ 
  stroke: '#3498db',  // blue
  strokeWidth: 2,
  strokeDasharray: '5 3'
}
```

**Label**: "AND" badge on the edge

## OR Edges

Orange dashed lines for vertical OR branches:

```
Cond: option_a
      │
      │ OR
      ▼
Cond: option_b
      │
      │ OR
      ▼
Cond: option_c
```

**Style**:
```typescript
{ 
  stroke: '#e67e22',  // orange
  strokeWidth: 2,
  strokeDasharray: '5 3'
}
```

**Label**: "OR" badge on the edge

## Spatial Logic

From architecture docs:
- **AND chains horizontally**: Same row, columns increment
- **OR branches vertically**: Same column, rows increment

## Edge Labels

AND and OR edges have label badges:

```tsx
// AND label
<rect fill="#3498db" rx="4">
  <text fill="white">AND</text>
</rect>

// OR label
<rect fill="#e67e22" rx="4">
  <text fill="white">OR</text>
</rect>
```

## Implementation Note

Only AND and OR edges need custom styling. Standard parent→child edges use React Flow's default edge with gray color.
