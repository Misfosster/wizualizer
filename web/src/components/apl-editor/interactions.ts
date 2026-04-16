import {
  Compartment,
  EditorSelection,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createJumpTargetLineExtension } from "./jump-target";
import {
  findNearestVariableDefinition,
  findVariableReferenceAtPosition,
  type VariableReference,
} from "./variable-jump";
import { createVariableReferenceHoverExtension } from "./variable-reference-mark";

const JUMP_TARGET_FLASH_MS = 1500;

export interface TimeoutRef {
  current: number | null;
}

interface EditorMouseDownOptions {
  view: EditorView;
  jumpTargetCompartment: Compartment;
  jumpTargetTimeoutRef: TimeoutRef;
}

interface VariableHoverOptions {
  view: EditorView;
  variableHoverCompartment: Compartment;
}

interface VariableHoverState {
  isModifierPressed: boolean;
  lastMouseCoords: { x: number; y: number } | null;
  hoveredReferenceKey: string | null;
}

function isPrimaryClick(event: MouseEvent): boolean {
  return event.button === 0;
}

function isJumpModifierPressed(event: MouseEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

function isJumpModifierKeyEvent(event: KeyboardEvent): boolean {
  return event.key === "Control" || event.key === "Meta";
}

function getVariableReferenceKey(reference: VariableReference | null): string | null {
  return reference
    ? `${reference.name}:${String(reference.from)}:${String(reference.to)}`
    : null;
}

function findVariableReferenceAtCoords(
  view: EditorView,
  coords: { x: number; y: number },
): VariableReference | null {
  const position = view.posAtCoords(coords);
  if (position === null) {
    return null;
  }

  return findVariableReferenceAtPosition(view.state.doc.toString(), position);
}

function dispatchCursorToEnd(view: EditorView): void {
  view.focus();
  view.dispatch({
    selection: EditorSelection.cursor(view.state.doc.length),
  });
}

function isBelowLastDocumentLine(event: MouseEvent, view: EditorView): boolean {
  const scrollBounds = view.scrollDOM.getBoundingClientRect();
  if (
    event.clientX < scrollBounds.left ||
    event.clientX > scrollBounds.right ||
    event.clientY < scrollBounds.top ||
    event.clientY > scrollBounds.bottom
  ) {
    return false;
  }

  const lastLineBlock = view.lineBlockAt(view.state.doc.length);
  const lastLineBottom =
    view.documentTop + lastLineBlock.top + lastLineBlock.height;

  return event.clientY > lastLineBottom;
}

export function clearJumpTargetLater(
  view: EditorView,
  jumpTargetCompartment: Compartment,
  jumpTargetTimeoutRef: TimeoutRef,
): void {
  if (jumpTargetTimeoutRef.current !== null) {
    window.clearTimeout(jumpTargetTimeoutRef.current);
  }

  jumpTargetTimeoutRef.current = window.setTimeout(() => {
    jumpTargetTimeoutRef.current = null;
    view.dispatch({
      effects: jumpTargetCompartment.reconfigure(
        createJumpTargetLineExtension(null),
      ),
    });
  }, JUMP_TARGET_FLASH_MS);
}

function tryJumpToVariableDefinition(
  event: MouseEvent,
  {
    view,
    jumpTargetCompartment,
    jumpTargetTimeoutRef,
  }: EditorMouseDownOptions,
): boolean {
  if (!isPrimaryClick(event) || !isJumpModifierPressed(event)) {
    return false;
  }

  const position = view.posAtCoords({
    x: event.clientX,
    y: event.clientY,
  });
  if (position === null) {
    return false;
  }

  const text = view.state.doc.toString();
  const reference = findVariableReferenceAtPosition(text, position);
  if (!reference) {
    return false;
  }

  const definition = findNearestVariableDefinition(
    text,
    reference.name,
    reference.lineNumber,
  );
  if (!definition) {
    return false;
  }

  const targetLine = view.state.doc.line(definition.lineNumber);
  event.preventDefault();
  event.stopPropagation();
  view.focus();
  view.dispatch({
    selection: EditorSelection.cursor(targetLine.from),
    effects: [
      EditorView.scrollIntoView(targetLine.from, { y: "center" }),
      jumpTargetCompartment.reconfigure(
        createJumpTargetLineExtension(definition.lineNumber),
      ),
    ],
  });
  clearJumpTargetLater(
    view,
    jumpTargetCompartment,
    jumpTargetTimeoutRef,
  );
  return true;
}

function trySnapEmptyAreaToDocumentEnd(
  event: MouseEvent,
  view: EditorView,
): boolean {
  if (!isPrimaryClick(event) || !isBelowLastDocumentLine(event, view)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  dispatchCursorToEnd(view);
  return true;
}

export function createEditorMouseDownHandler(
  options: EditorMouseDownOptions,
): (event: MouseEvent) => void {
  return (event) => {
    if (tryJumpToVariableDefinition(event, options)) {
      return;
    }

    trySnapEmptyAreaToDocumentEnd(event, options.view);
  };
}

export function createVariableHoverHandlers({
  view,
  variableHoverCompartment,
}: VariableHoverOptions): {
  handleKeyDown: (event: KeyboardEvent) => void;
  handleKeyUp: (event: KeyboardEvent) => void;
  handleMouseLeave: () => void;
  handleMouseMove: (event: MouseEvent) => void;
  reset: () => void;
} {
  const state: VariableHoverState = {
    isModifierPressed: false,
    lastMouseCoords: null,
    hoveredReferenceKey: null,
  };

  function updateHover(reference: VariableReference | null): void {
    const nextKey = getVariableReferenceKey(reference);
    if (nextKey === state.hoveredReferenceKey) {
      return;
    }

    state.hoveredReferenceKey = nextKey;
    view.dispatch({
      effects: variableHoverCompartment.reconfigure(
        createVariableReferenceHoverExtension(reference),
      ),
    });
  }

  function updateHoverFromLastCoords(): void {
    if (!state.isModifierPressed || !state.lastMouseCoords) {
      updateHover(null);
      return;
    }

    updateHover(findVariableReferenceAtCoords(view, state.lastMouseCoords));
  }

  function reset(): void {
    state.isModifierPressed = false;
    state.lastMouseCoords = null;
    updateHover(null);
  }

  return {
    handleKeyDown(event) {
      if (!isJumpModifierKeyEvent(event)) {
        return;
      }

      state.isModifierPressed = true;
      updateHoverFromLastCoords();
    },
    handleKeyUp(event) {
      if (!isJumpModifierKeyEvent(event)) {
        return;
      }

      state.isModifierPressed = event.ctrlKey || event.metaKey;
      updateHoverFromLastCoords();
    },
    handleMouseLeave() {
      state.lastMouseCoords = null;
      updateHover(null);
    },
    handleMouseMove(event) {
      state.lastMouseCoords = { x: event.clientX, y: event.clientY };
      state.isModifierPressed = isJumpModifierPressed(event);
      updateHoverFromLastCoords();
    },
    reset,
  };
}
