import { type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

export function createJumpTargetLineExtension(
  lineNumber: number | null,
): Extension {
  if (!lineNumber) {
    return [];
  }

  return EditorView.decorations.compute(["doc"], (state) => {
    if (lineNumber < 1 || lineNumber > state.doc.lines) {
      return Decoration.none;
    }

    const line = state.doc.line(lineNumber);
    return Decoration.set([
      Decoration.line({ class: "lc-apl-editor-jump-target-line" }).range(
        line.from,
      ),
    ]);
  });
}
