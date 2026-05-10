import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
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
  createLineNumberGutterGraphJumpHandler,
  createVariableHoverHandlers,
} from "./interactions";
import {
  createActionListReferenceHoverExtension,
  createActionListReferenceMarksExtension,
} from "./action-list-reference-mark";
import { createJumpTargetLineExtension } from "./jump-target";
import { aplLanguage } from "./language";
import {
  createAplSearchHighlightExtension,
  findAplSearchMatches,
  getSelectedSearchText,
  selectSearchMatch,
  type AplSearchMatch,
} from "./search";
import { aplEditorTheme, aplHighlightStyle } from "./theme";
import type { AplCodeEditorProps } from "./types";
import {
  createVariableReferenceHoverExtension,
  createVariableReferenceMarksExtension,
} from "./variable-reference-mark";

interface ChangeRef {
  current: (value: string) => void;
}

interface OpenSearchRef {
  current: (view: EditorView) => boolean;
}

function createEditorExtensions(
  errorLineCompartment: Compartment,
  jumpTargetCompartment: Compartment,
  variableHoverCompartment: Compartment,
  actionListHoverCompartment: Compartment,
  completionContextCompartment: Compartment,
  searchHighlightCompartment: Compartment,
  onChangeRef: ChangeRef,
  onOpenSearchRef: OpenSearchRef,
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
    }),
    keymap.of([
      {
        key: "Mod-f",
        preventDefault: true,
        run: (view) => onOpenSearchRef.current(view),
      },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
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
    searchHighlightCompartment.of(createAplSearchHighlightExtension([], 0)),
  ];
}

function getSearchMatchLabel(
  matches: readonly AplSearchMatch[],
  currentIndex: number,
): string {
  if (matches.length === 0) {
    return "0/0";
  }
  return `${String(currentIndex + 1)}/${String(matches.length)}`;
}

export function AplCodeEditor({
  value,
  parseErrorLineNumber,
  lineJumpRequest,
  completionContext,
  onCtrlClickLineNumber,
  onChange,
}: AplCodeEditorProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const initialValueRef = useRef(value);
  const initialCompletionContextRef = useRef(completionContext);
  const onChangeRef = useRef(onChange);
  const onCtrlClickLineNumberRef = useRef(onCtrlClickLineNumber);
  const onOpenSearchRef = useRef<OpenSearchRef["current"]>(() => true);
  const parseErrorLineNumberRef = useRef(parseErrorLineNumber);
  const jumpTargetTimeoutRef = useRef<number | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCurrentIndex, setSearchCurrentIndex] = useState(0);
  const [jumpModifierHeld, setJumpModifierHeld] = useState(false);
  const jumpModifierHeldRef = useRef(false);
  jumpModifierHeldRef.current = jumpModifierHeld;
  const errorLineCompartment = useMemo(() => new Compartment(), []);
  const jumpTargetCompartment = useMemo(() => new Compartment(), []);
  const variableHoverCompartment = useMemo(() => new Compartment(), []);
  const actionListHoverCompartment = useMemo(() => new Compartment(), []);
  const completionContextCompartment = useMemo(() => new Compartment(), []);
  const searchHighlightCompartment = useMemo(() => new Compartment(), []);
  const searchMatches = useMemo(
    () =>
      isSearchOpen
        ? findAplSearchMatches(value, searchQuery)
        : [],
    [isSearchOpen, searchQuery, value],
  );
  const searchMatchLabel = getSearchMatchLabel(
    searchMatches,
    searchCurrentIndex,
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onCtrlClickLineNumberRef.current = onCtrlClickLineNumber;
  }, [onCtrlClickLineNumber]);

  useEffect(() => {
    function syncJumpModifier(event: KeyboardEvent): void {
      setJumpModifierHeld(event.ctrlKey || event.metaKey);
    }

    function clearJumpModifier(): void {
      setJumpModifierHeld(false);
    }

    window.addEventListener("keydown", syncJumpModifier, true);
    window.addEventListener("keyup", syncJumpModifier, true);
    window.addEventListener("blur", clearJumpModifier);

    return () => {
      window.removeEventListener("keydown", syncJumpModifier, true);
      window.removeEventListener("keyup", syncJumpModifier, true);
      window.removeEventListener("blur", clearJumpModifier);
    };
  }, []);

  const gutterGraphJumpHandler = useMemo(
    () =>
      createLineNumberGutterGraphJumpHandler({
        onCtrlClickLineNumber: (lineNumber) => {
          onCtrlClickLineNumberRef.current?.(lineNumber);
        },
      }),
    [],
  );

  useEffect(() => {
    parseErrorLineNumberRef.current = parseErrorLineNumber;
  }, [parseErrorLineNumber]);

  const openSearch = useCallback((view: EditorView): boolean => {
    const selectedText = getSelectedSearchText(view);
    if (selectedText) {
      setSearchQuery(selectedText);
      setSearchCurrentIndex(0);
    }
    setIsSearchOpen(true);
    return true;
  }, []);

  useEffect(() => {
    onOpenSearchRef.current = openSearch;
  }, [openSearch]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const handle = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(handle);
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (searchMatches.length === 0) {
      if (searchCurrentIndex !== 0) {
        setSearchCurrentIndex(0);
      }
      return;
    }

    if (searchCurrentIndex >= searchMatches.length) {
      setSearchCurrentIndex(searchMatches.length - 1);
    }
  }, [searchCurrentIndex, searchMatches.length]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: searchHighlightCompartment.reconfigure(
        createAplSearchHighlightExtension(searchMatches, searchCurrentIndex),
      ),
    });
    if (searchMatches.length > 0) {
      selectSearchMatch(view, searchMatches[searchCurrentIndex]);
    }
  }, [searchCurrentIndex, searchHighlightCompartment, searchMatches]);

  const jumpToSearchMatch = useCallback(
    (delta: number) => {
      if (searchMatches.length === 0) {
        return;
      }
      setSearchCurrentIndex(
        (current) =>
          (current + delta + searchMatches.length) % searchMatches.length,
      );
    },
    [searchMatches.length],
  );

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    viewRef.current?.focus();
  }, []);

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
          searchHighlightCompartment,
          onChangeRef,
          onOpenSearchRef,
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
    view.dom.addEventListener("mousedown", gutterGraphJumpHandler, true);
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
    view.dom.classList.toggle(
      "lc-apl-editor--jump-modifier",
      jumpModifierHeldRef.current,
    );

    return () => {
      view.dom.removeEventListener("mousedown", gutterGraphJumpHandler, true);
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
    gutterGraphJumpHandler,
    searchHighlightCompartment,
    actionListHoverCompartment,
    errorLineCompartment,
    jumpTargetCompartment,
    variableHoverCompartment,
  ]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dom.classList.toggle("lc-apl-editor--jump-modifier", jumpModifierHeld);
  }, [jumpModifierHeld]);

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

  return (
    <div className="relative">
      <div ref={parentRef} data-testid="apl-code-editor" />
      {isSearchOpen ? (
        <div
          className="absolute right-3 top-3 z-20 flex max-w-[min(30rem,calc(100%-1.5rem))] items-center gap-1 rounded-md border border-slate-500/40 bg-slate-950/95 p-1.5 text-slate-100 shadow-xl"
          data-apl-editor-search-panel=""
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
        >
          <Search
            aria-hidden="true"
            className="ml-1 h-4 w-4 shrink-0 text-slate-400"
          />
          <input
            ref={searchInputRef}
            aria-label="Find in APL"
            data-apl-editor-search-input=""
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchCurrentIndex(0);
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
                event.preventDefault();
                event.currentTarget.select();
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                jumpToSearchMatch(event.shiftKey ? -1 : 1);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closeSearch();
              }
            }}
            placeholder="Find"
            className="h-7 w-48 min-w-0 rounded border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300"
          />
          <span
            className="min-w-12 text-center text-[11px] font-medium tabular-nums text-slate-300"
            data-apl-editor-search-count=""
          >
            {searchMatchLabel}
          </span>
          <button
            type="button"
            aria-label="Previous match"
            disabled={searchMatches.length === 0}
            onClick={() => {
              jumpToSearchMatch(-1);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next match"
            disabled={searchMatches.length === 0}
            onClick={() => {
              jumpToSearchMatch(1);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Close search"
            onClick={closeSearch}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
