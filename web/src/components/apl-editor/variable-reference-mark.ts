import { type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import {
  findVariableReferences,
  type VariableReference,
} from "./variable-jump";

const variableReferenceMark = Decoration.mark({
  class: "lc-apl-editor-variable-ref",
});

const variableReferenceHoverMark = Decoration.mark({
  class: "lc-apl-editor-variable-ref--hover",
});

function isSameVariableReference(
  expected: VariableReference,
  actualText: string,
): boolean {
  return actualText === `variable.${expected.name}`;
}

export function createVariableReferenceMarksExtension(): Extension {
  return EditorView.decorations.compute(["doc"], (state) => {
    const references = findVariableReferences(state.doc.toString());
    if (references.length === 0) {
      return Decoration.none;
    }

    return Decoration.set(
      references.map((reference) =>
        variableReferenceMark.range(reference.from, reference.to),
      ),
      true,
    );
  });
}

export function createVariableReferenceHoverExtension(
  reference: VariableReference | null,
): Extension {
  if (!reference) {
    return [];
  }

  return EditorView.decorations.compute(["doc"], (state) => {
    if (reference.to > state.doc.length) {
      return Decoration.none;
    }

    const text = state.doc.sliceString(reference.from, reference.to);
    if (!isSameVariableReference(reference, text)) {
      return Decoration.none;
    }

    return Decoration.set([
      variableReferenceHoverMark.range(reference.from, reference.to),
    ]);
  });
}
