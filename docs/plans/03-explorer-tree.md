# Explorer Tree

The explorer tree provides a file-system-like view that mirrors the graph hierarchy.

## Structure

```
Actions/                              (root - always expanded)
├── precombat/                        (folder - expandable)
│   ├── flask                         (action - expandable)
│   │   ├── condition: buff.flask.up
│   │   └── value: 10
│   └── potion
│       └── condition: ...
├── cds/                              (folder - expandable)
│   └── cooldown
│       ├── condition: ...
│       └── op: set
├── auto_attack                       (root-level action - expandable)
│   └── condition: ...
└── rupture                           (root-level action - expandable)
    ├── condition: (complex tree)
    ├── op: set
    └── target_if: ...
```

## Hierarchy Levels

| Level | Node Type | Expandable | Shows When Expanded |
|-------|-----------|------------|---------------------|
| 1 | Root ("Actions") | Always expanded | Folders + root-level actions |
| 2 | Folder | Yes | Actions inside folder |
| 2 | Root-level Action | Yes | Action fields |
| 3 | Action (in folder) | Yes | Action fields |
| 4+ | Fields | No (leaf) | - |

## Action Fields

When an action is expanded, it shows its properties:

- `condition` - the condition expression (may be complex tree)
- `value` - numeric value if present
- `op` - operator (set, add, etc.) if present
- `target_if` - target condition if present
- Other fields as defined by the parser

The action **name** is the tree item label, not a child field.

## Root-Level Actions

Actions from `actions+=` (without a folder suffix like `.precombat`):
- Appear at the same level as folders
- Are siblings of folders, not inside a "Main" folder
- Examples: `actions+=auto_attack`, `actions+=melee`

## Folder Display Names

| APL Name | Display Name |
|----------|--------------|
| `actions.precombat` | Precombat |
| `actions.cds` | CDs |
| `actions.finish` | Finish |
| `actions.aoe` | AoE |

## Selection Sync

Selection syncs bidirectionally between tree and canvas:
- Click action in tree → canvas pans to that node
- Click node in canvas → tree expands and highlights that item

## Drag and Drop (Future)

Planned for later:
- Drag actions to reorder within folder
- Drag actions between folders
- Drag to create new folder grouping
