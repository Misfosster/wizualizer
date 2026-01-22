# Undo/Redo

History tracking for APL text changes using Zustand temporal middleware.

## Approach

Use `zundo` package - the standard temporal middleware for Zustand.

## Installation

```bash
npm install zundo
```

## Store Integration

```typescript
// src/state/store.ts
import { create } from 'zustand';
import { temporal } from 'zundo';

export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      aplText: getInitialAplText(),
      setAplText: (aplText) => set({ aplText }),
      // ... rest of store
    }),
    {
      // Only track aplText changes, not transient UI state
      partialize: (state) => ({ aplText: state.aplText }),
      limit: 50,  // Keep last 50 states
    }
  )
);
```

## Accessing History

```typescript
// Get temporal store
const { undo, redo, pastStates, futureStates } = useEditorStore.temporal.getState();

// Check if can undo/redo
const canUndo = pastStates.length > 0;
const canRedo = futureStates.length > 0;
```

## Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Undo | Cmd+Z | Ctrl+Z |
| Redo | Cmd+Shift+Z | Ctrl+Shift+Z |

## Implementation

```typescript
// src/hooks/useUndoRedo.ts
import { useEffect } from 'react';
import { useEditorStore } from '@/state/store';

export function useUndoRedo() {
  const { undo, redo } = useEditorStore.temporal.getState();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      
      if (isMod && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
}
```

## What's Tracked

**Tracked** (in history):
- `aplText` - the canonical APL string

**Not tracked** (transient UI state):
- Node positions during drag
- Selection state
- Collapsed folders
- Viewport pan/zoom

## Why Only aplText?

The APL text is the source of truth. All other state (AST, graph nodes, layout) derives from it. Tracking only aplText keeps history simple and ensures consistent state on undo/redo.

## UI Feedback (Future)

Potential additions:
- Undo/Redo buttons in toolbar
- "Unsaved changes" indicator
- History panel showing recent changes
