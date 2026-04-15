import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const aplEditorTheme = EditorView.theme(
  {
    "&": {
      overflow: "hidden",
      border: "1px solid rgba(148, 163, 184, 0.18)",
      borderRadius: "0.5rem",
      backgroundColor: "#121722",
      color: "#DDE3EA",
      fontSize: "13px",
      boxShadow:
        "0 18px 40px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.02) inset",
    },
    "&.cm-focused": {
      outline: "2px solid rgba(99, 102, 241, 0.7)",
      outlineOffset: "2px",
    },
    ".cm-scroller": {
      minHeight: "56vh",
      maxHeight: "68vh",
      overflow: "auto",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineHeight: "1.45",
    },
    ".cm-content": {
      padding: "0.75rem 0",
      caretColor: "#A5F3FC",
    },
    ".cm-line": {
      padding: "0 1rem",
    },
    ".cm-gutters": {
      borderRight: "1px solid rgba(148, 163, 184, 0.14)",
      backgroundColor: "#0F141D",
      color: "#657286",
      minHeight: "56vh",
    },
    ".cm-gutter": {
      minHeight: "56vh",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "2.5rem",
      padding: "0 0.75rem 0 0.5rem",
    },
    ".cm-activeLine": {
      backgroundColor: "#1A2230",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#172032",
      color: "#AAB8CB",
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(125, 211, 252, 0.22) !important",
    },
    ".cm-cursor": {
      borderLeftColor: "#A5F3FC",
    },
    ".cm-placeholder": {
      color: "#657286",
    },
    ".lc-apl-editor-error-line": {
      backgroundColor: "rgba(248, 113, 113, 0.15)",
    },
    ".lc-apl-editor-error-gutter": {
      backgroundColor: "rgba(248, 113, 113, 0.18)",
      color: "#FCA5A5",
    },
  },
  { dark: true },
);

export const aplHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: "#7C8A83", fontStyle: "italic" },
  { tag: tags.namespace, color: "#F6C76B", fontWeight: "600" },
  { tag: tags.tagName, color: "#22D3EE", fontWeight: "600" },
  { tag: tags.attributeName, color: "#C4A7FF" },
  { tag: tags.string, color: "#3DDC97" },
  { tag: tags.number, color: "#F2D36B" },
  {
    tag: [
      tags.operator,
      tags.definitionOperator,
      tags.updateOperator,
      tags.logicOperator,
      tags.compareOperator,
      tags.arithmeticOperator,
    ],
    color: "#FF7A90",
  },
  { tag: tags.paren, color: "#A8B3C4" },
  { tag: tags.punctuation, color: "#7E8AA0" },
  { tag: tags.variableName, color: "#DDE3EA" },
  { tag: tags.keyword, color: "#F6C76B" },
]);
