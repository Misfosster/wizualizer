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
import { createErrorLineExtension } from "./error-line";
import { createAplFoldingExtension } from "./folding";
import {
  clearJumpTargetLater,
  createEditorMouseDownHandler,
  createVariableHoverHandlers,
} from "./interactions";
import { createJumpTargetLineExtension } from "./jump-target";
import { aplLanguage } from "./language";
import { aplEditorTheme, aplHighlightStyle } from "./theme";
import type { AplCodeEditorProps } from "./types";
import {
  createVariableReferenceHoverExtension,
  createVariableReferenceMarksExtension,
} from "./variable-reference-mark";

interface ChangeRef {
  current: (value: string) => void;
}

function createEditorExtensions(
  errorLineCompartment: Compartment,
  jumpTargetCompartment: Compartment,
  variableHoverCompartment: Compartment,
  onChangeRef: ChangeRef,
  parseErrorLineNumber: number | null,
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
    createAplFoldingExtension(),
    createVariableReferenceMarksExtension(),
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
    }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    errorLineCompartment.of(
      createErrorLineExtension(parseErrorLineNumber),
    ),
    jumpTargetCompartment.of(createJumpTargetLineExtension(null)),
    variableHoverCompartment.of(
      createVariableReferenceHoverExtension(null),
    ),
  ];
}

export function AplCodeEditor({
  value,
  parseErrorLineNumber,
  lineJumpRequest,
  onChange,
}: AplCodeEditorProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const parseErrorLineNumberRef = useRef(parseErrorLineNumber);
  const jumpTargetTimeoutRef = useRef<number | null>(null);
  const errorLineCompartment = useMemo(() => new Compartment(), []);
  const jumpTargetCompartment = useMemo(() => new Compartment(), []);
  const variableHoverCompartment = useMemo(() => new Compartment(), []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
          onChangeRef,
          parseErrorLineNumberRef.current,
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
    view.dom.addEventListener("mousedown", handleMouseDown);
    view.dom.addEventListener("mouseleave", variableHoverHandlers.handleMouseLeave);
    view.dom.addEventListener("mousemove", variableHoverHandlers.handleMouseMove);
    window.addEventListener("blur", variableHoverHandlers.reset);
    window.addEventListener("keydown", variableHoverHandlers.handleKeyDown);
    window.addEventListener("keyup", variableHoverHandlers.handleKeyUp);

    viewRef.current = view;

    return () => {
      view.dom.removeEventListener("mousedown", handleMouseDown);
      view.dom.removeEventListener(
        "mouseleave",
        variableHoverHandlers.handleMouseLeave,
      );
      view.dom.removeEventListener(
        "mousemove",
        variableHoverHandlers.handleMouseMove,
      );
      window.removeEventListener("blur", variableHoverHandlers.reset);
      window.removeEventListener("keydown", variableHoverHandlers.handleKeyDown);
      window.removeEventListener("keyup", variableHoverHandlers.handleKeyUp);
      if (jumpTargetTimeoutRef.current !== null) {
        window.clearTimeout(jumpTargetTimeoutRef.current);
        jumpTargetTimeoutRef.current = null;
      }
      view.destroy();
      viewRef.current = null;
    };
  }, [errorLineCompartment, jumpTargetCompartment, variableHoverCompartment]);

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
