import { useEffect, useMemo, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
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
import { aplLanguage } from "./language";
import { aplEditorTheme, aplHighlightStyle } from "./theme";
import type { AplCodeEditorProps } from "./types";

interface ChangeRef {
  current: (value: string) => void;
}

function createEditorExtensions(
  errorLineCompartment: Compartment,
  onChangeRef: ChangeRef,
  parseErrorLineNumber: number | null,
): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    highlightActiveLine(),
    bracketMatching(),
    aplLanguage,
    syntaxHighlighting(aplHighlightStyle),
    aplEditorTheme,
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
  ];
}

export function AplCodeEditor({
  value,
  parseErrorLineNumber,
  onChange,
}: AplCodeEditorProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const parseErrorLineNumberRef = useRef(parseErrorLineNumber);
  const errorLineCompartment = useMemo(() => new Compartment(), []);

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
          onChangeRef,
          parseErrorLineNumberRef.current,
        ),
      }),
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [errorLineCompartment]);

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

  return <div ref={parentRef} data-testid="apl-code-editor" />;
}
