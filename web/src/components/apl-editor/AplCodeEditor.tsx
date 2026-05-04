import { useEffect, useMemo, useRef } from "react";
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
} from "@codemirror/view";
import { bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  createAplCompletionContextExtension,
  createAplCompletionExtension,
} from "./completion";
import { createErrorLineExtension } from "./error-line";
import { createAplFoldingExtension } from "./folding";
import {
  createActionListHoverHandlers,
  clearJumpTargetLater,
  createEditorMouseDownHandler,
  createVariableHoverHandlers,
} from "./interactions";
import {
  createActionListReferenceHoverExtension,
  createActionListReferenceMarksExtension,
} from "./action-list-reference-mark";
import { createJumpTargetLineExtension } from "./jump-target";
import { aplLanguage } from "./language";
import { aplEditorTheme, aplHighlightStyle } from "./theme";
import type { AplCodeEditorProps, AplEditorPosition } from "./types";
import {
  createVariableReferenceHoverExtension,
  createVariableReferenceMarksExtension,
} from "./variable-reference-mark";

interface ChangeRef {
  current: (value: string) => void;
}

interface PositionChangeRef {
  current: ((position: AplEditorPosition) => void) | undefined;
}

function getEditorPosition(view: EditorView): AplEditorPosition {
  const selectionLineNumber = view.state.doc.lineAt(
    view.state.selection.main.head,
  ).number;
  const firstVisibleLine = view.viewportLineBlocks[0];
  const lastVisibleLine =
    view.viewportLineBlocks[view.viewportLineBlocks.length - 1];
  const viewportFromLineNumber = view.state.doc.lineAt(
    firstVisibleLine.from,
  ).number;
  const viewportToLineNumber = view.state.doc.lineAt(lastVisibleLine.to).number;
  const lineNumber =
    selectionLineNumber >= viewportFromLineNumber &&
    selectionLineNumber <= viewportToLineNumber
      ? selectionLineNumber
      : viewportFromLineNumber;

  return {
    lineNumber,
    viewportFromLineNumber,
    viewportToLineNumber,
  };
}

function notifyEditorPosition(
  view: EditorView,
  onPositionChange: PositionChangeRef["current"],
): void {
  onPositionChange?.(getEditorPosition(view));
}

function createEditorExtensions(
  errorLineCompartment: Compartment,
  jumpTargetCompartment: Compartment,
  variableHoverCompartment: Compartment,
  actionListHoverCompartment: Compartment,
  completionContextCompartment: Compartment,
  onChangeRef: ChangeRef,
  onPositionChangeRef: PositionChangeRef,
  parseErrorLineNumber: number | null,
  completionContext: AplCodeEditorProps["completionContext"],
): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    dropCursor(),
    rectangularSelection(),
    highlightActiveLine(),
    bracketMatching(),
    aplLanguage,
    syntaxHighlighting(aplHighlightStyle),
    aplEditorTheme,
    createAplCompletionExtension(),
    createAplFoldingExtension(),
    createVariableReferenceMarksExtension(),
    createActionListReferenceMarksExtension(),
    placeholder("Paste APL..."),
    EditorState.tabSize.of(2),
    EditorView.contentAttributes.of({
      "aria-label": "APL editor",
      "aria-multiline": "true",
      "data-testid": "apl-code-editor-input",
      role: "textbox",
      spellcheck: "false",
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        notifyEditorPosition(update.view, onPositionChangeRef.current);
      }
    }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    errorLineCompartment.of(
      createErrorLineExtension(parseErrorLineNumber),
    ),
    jumpTargetCompartment.of(createJumpTargetLineExtension(null)),
    variableHoverCompartment.of(
      createVariableReferenceHoverExtension(null),
    ),
    actionListHoverCompartment.of(
      createActionListReferenceHoverExtension(null),
    ),
    completionContextCompartment.of(
      createAplCompletionContextExtension(completionContext),
    ),
  ];
}

export function AplCodeEditor({
  value,
  parseErrorLineNumber,
  lineJumpRequest,
  completionContext,
  onPositionChange,
  onChange,
}: AplCodeEditorProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(value);
  const initialCompletionContextRef = useRef(completionContext);
  const onChangeRef = useRef(onChange);
  const onPositionChangeRef = useRef(onPositionChange);
  const parseErrorLineNumberRef = useRef(parseErrorLineNumber);
  const jumpTargetTimeoutRef = useRef<number | null>(null);
  const errorLineCompartment = useMemo(() => new Compartment(), []);
  const jumpTargetCompartment = useMemo(() => new Compartment(), []);
  const variableHoverCompartment = useMemo(() => new Compartment(), []);
  const actionListHoverCompartment = useMemo(() => new Compartment(), []);
  const completionContextCompartment = useMemo(() => new Compartment(), []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  useEffect(() => {
    parseErrorLineNumberRef.current = parseErrorLineNumber;
  }, [parseErrorLineNumber]);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) {
      return;
    }

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: createEditorExtensions(
          errorLineCompartment,
          jumpTargetCompartment,
          variableHoverCompartment,
          actionListHoverCompartment,
          completionContextCompartment,
          onChangeRef,
          onPositionChangeRef,
          parseErrorLineNumberRef.current,
          initialCompletionContextRef.current,
        ),
      }),
    });
    const handleMouseDown = createEditorMouseDownHandler({
      view,
      jumpTargetCompartment,
      jumpTargetTimeoutRef,
    });
    const variableHoverHandlers = createVariableHoverHandlers({
      view,
      variableHoverCompartment,
    });
    const actionListHoverHandlers = createActionListHoverHandlers({
      view,
      actionListHoverCompartment,
    });
    view.dom.addEventListener("mousedown", handleMouseDown);
    view.dom.addEventListener("mouseleave", variableHoverHandlers.handleMouseLeave);
    view.dom.addEventListener(
      "mouseleave",
      actionListHoverHandlers.handleMouseLeave,
    );
    view.dom.addEventListener("mousemove", variableHoverHandlers.handleMouseMove);
    view.dom.addEventListener(
      "mousemove",
      actionListHoverHandlers.handleMouseMove,
    );
    window.addEventListener("blur", variableHoverHandlers.reset);
    window.addEventListener("blur", actionListHoverHandlers.reset);
    window.addEventListener("keydown", variableHoverHandlers.handleKeyDown);
    window.addEventListener("keydown", actionListHoverHandlers.handleKeyDown);
    window.addEventListener("keyup", variableHoverHandlers.handleKeyUp);
    window.addEventListener("keyup", actionListHoverHandlers.handleKeyUp);

    viewRef.current = view;
    notifyEditorPosition(view, onPositionChangeRef.current);

    return () => {
      view.dom.removeEventListener("mousedown", handleMouseDown);
      view.dom.removeEventListener(
        "mouseleave",
        variableHoverHandlers.handleMouseLeave,
      );
      view.dom.removeEventListener(
        "mouseleave",
        actionListHoverHandlers.handleMouseLeave,
      );
      view.dom.removeEventListener(
        "mousemove",
        variableHoverHandlers.handleMouseMove,
      );
      view.dom.removeEventListener(
        "mousemove",
        actionListHoverHandlers.handleMouseMove,
      );
      window.removeEventListener("blur", variableHoverHandlers.reset);
      window.removeEventListener("blur", actionListHoverHandlers.reset);
      window.removeEventListener("keydown", variableHoverHandlers.handleKeyDown);
      window.removeEventListener(
        "keydown",
        actionListHoverHandlers.handleKeyDown,
      );
      window.removeEventListener("keyup", variableHoverHandlers.handleKeyUp);
      window.removeEventListener("keyup", actionListHoverHandlers.handleKeyUp);
      if (jumpTargetTimeoutRef.current !== null) {
        window.clearTimeout(jumpTargetTimeoutRef.current);
        jumpTargetTimeoutRef.current = null;
      }
      view.destroy();
      viewRef.current = null;
    };
  }, [
    completionContextCompartment,
    actionListHoverCompartment,
    errorLineCompartment,
    jumpTargetCompartment,
    variableHoverCompartment,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: errorLineCompartment.reconfigure(
        createErrorLineExtension(parseErrorLineNumber),
      ),
    });
  }, [errorLineCompartment, parseErrorLineNumber]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: completionContextCompartment.reconfigure(
        createAplCompletionContextExtension(completionContext),
      ),
    });
  }, [completionContext, completionContextCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !lineJumpRequest) {
      return;
    }

    const lineNumber = Math.min(
      Math.max(1, lineJumpRequest.lineNumber),
      view.state.doc.lines,
    );
    const targetLine = view.state.doc.line(lineNumber);

    view.focus();
    view.dispatch({
      selection: EditorSelection.cursor(targetLine.from),
      effects: [
        EditorView.scrollIntoView(targetLine.from, { y: "center" }),
        jumpTargetCompartment.reconfigure(
          createJumpTargetLineExtension(lineNumber),
        ),
      ],
    });
    clearJumpTargetLater(
      view,
      jumpTargetCompartment,
      jumpTargetTimeoutRef,
    );
  }, [jumpTargetCompartment, lineJumpRequest]);

  return <div ref={parentRef} data-testid="apl-code-editor" />;
}
