import { EditorSelection, type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

export interface AplSearchMatch {
  from: number;
  to: number;
}

const MAX_INITIAL_SEARCH_TEXT_LENGTH = 120;

export function findAplSearchMatches(
  text: string,
  query: string,
): AplSearchMatch[] {
  if (!query) {
    return [];
  }

  const matches: AplSearchMatch[] = [];
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let from = 0;
  while (from <= normalizedText.length) {
    const index = normalizedText.indexOf(normalizedQuery, from);
    if (index === -1) {
      break;
    }
    matches.push({ from: index, to: index + query.length });
    from = index + Math.max(1, query.length);
  }
  return matches;
}

export function createAplSearchHighlightExtension(
  matches: readonly AplSearchMatch[],
  currentIndex: number,
): Extension {
  const ranges = matches.map((match, index) =>
    Decoration.mark({
      class:
        index === currentIndex
          ? "lc-apl-editor-search-match lc-apl-editor-search-match--current"
          : "lc-apl-editor-search-match",
    }).range(match.from, match.to),
  );

  return EditorView.decorations.of(Decoration.set(ranges, true));
}

export function getSelectedSearchText(view: EditorView): string {
  const selection = view.state.selection.main;
  if (selection.empty) {
    return "";
  }

  const text = view.state.sliceDoc(selection.from, selection.to);
  if (
    text.length > MAX_INITIAL_SEARCH_TEXT_LENGTH ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return "";
  }

  return text;
}

export function selectSearchMatch(
  view: EditorView,
  match: AplSearchMatch,
): void {
  view.dispatch({
    selection: EditorSelection.range(match.from, match.to),
    effects: EditorView.scrollIntoView(match.from, { y: "center" }),
  });
}
