import { RangeSet, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutterLineClass,
} from "@codemirror/view";

class ErrorLineMarker extends GutterMarker {
  elementClass = "lc-apl-editor-error-gutter";

  eq(other: GutterMarker): boolean {
    return other instanceof ErrorLineMarker;
  }
}

const errorLineMarker = new ErrorLineMarker();
const emptyGutterMarkers = RangeSet.of<GutterMarker>([]);

export function createErrorLineExtension(
  lineNumber: number | null,
): Extension {
  if (!lineNumber) {
    return [];
  }

  return [
    EditorView.decorations.compute(["doc"], (state) => {
      if (lineNumber < 1 || lineNumber > state.doc.lines) {
        return Decoration.none;
      }

      const line = state.doc.line(lineNumber);
      return Decoration.set([
        Decoration.line({ class: "lc-apl-editor-error-line" }).range(
          line.from,
        ),
      ]);
    }),
    gutterLineClass.compute(["doc"], (state) => {
      if (lineNumber < 1 || lineNumber > state.doc.lines) {
        return emptyGutterMarkers;
      }

      const line = state.doc.line(lineNumber);
      return RangeSet.of([errorLineMarker.range(line.from)]);
    }),
  ];
}
