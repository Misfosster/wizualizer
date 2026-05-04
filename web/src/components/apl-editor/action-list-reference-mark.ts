import { type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import {
  findActionListReferences,
  type ActionListReference,
} from "./action-list-jump";

const actionListReferenceMark = Decoration.mark({
  class: "lc-apl-editor-action-list-ref",
});

const actionListReferenceHoverMark = Decoration.mark({
  class: "lc-apl-editor-action-list-ref--hover",
});

function isSameActionListReference(
  expected: ActionListReference,
  actualText: string,
): boolean {
  return actualText === expected.name;
}

export function createActionListReferenceMarksExtension(): Extension {
  return EditorView.decorations.compute(["doc"], (state) => {
    const references = findActionListReferences(state.doc.toString());
    if (references.length === 0) {
      return Decoration.none;
    }

    return Decoration.set(
      references.map((reference) =>
        actionListReferenceMark.range(reference.from, reference.to),
      ),
      true,
    );
  });
}

export function createActionListReferenceHoverExtension(
  reference: ActionListReference | null,
): Extension {
  if (!reference) {
    return [];
  }

  return EditorView.decorations.compute(["doc"], (state) => {
    if (reference.to > state.doc.length) {
      return Decoration.none;
    }

    const text = state.doc.sliceString(reference.from, reference.to);
    if (!isSameActionListReference(reference, text)) {
      return Decoration.none;
    }

    return Decoration.set([
      actionListReferenceHoverMark.range(reference.from, reference.to),
    ]);
  });
}
