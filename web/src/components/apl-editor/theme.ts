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
    ".cm-foldGutter .cm-gutterElement": {
      minWidth: "1.25rem",
      padding: "0 0.25rem",
      color: "#657286",
    },
    ".lc-apl-editor-fold-marker": {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "1rem",
      height: "1rem",
      borderRadius: "3px",
      color: "#AAB8CB",
      cursor: "pointer",
      lineHeight: "1",
    },
    ".lc-apl-editor-fold-marker::before": {
      content: '""',
      display: "block",
      width: "0",
      height: "0",
    },
    ".lc-apl-editor-fold-marker--open::before": {
      borderLeft: "4px solid transparent",
      borderRight: "4px solid transparent",
      borderTop: "5px solid currentColor",
      transform: "translateY(1px)",
    },
    ".lc-apl-editor-fold-marker--closed::before": {
      borderTop: "4px solid transparent",
      borderBottom: "4px solid transparent",
      borderLeft: "5px solid currentColor",
      transform: "translateX(1px)",
    },
    ".lc-apl-editor-fold-marker:hover": {
      backgroundColor: "rgba(125, 211, 252, 0.12)",
      color: "#E0F2FE",
    },
    ".cm-foldPlaceholder": {
      border: "0",
      borderRadius: "0",
      backgroundColor: "transparent",
      color: "rgba(170, 184, 203, 0.58)",
      padding: "0 0.15rem",
      margin: "0 0.05rem",
    },
    ".cm-activeLine": {
      backgroundColor: "#1A2230",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#172032",
      color: "#AAB8CB",
    },
    ".cm-content ::selection": {
      background: "rgba(96, 165, 250, 0.42)",
      color: "#F8FAFC",
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
    ".lc-apl-editor-variable-ref": {
      color: "#A7C7FF",
      fontWeight: "650",
    },
    ".lc-apl-editor-variable-ref *": {
      color: "#A7C7FF",
      fontWeight: "650",
    },
    ".lc-apl-editor-action-list-ref": {
      color: "#F6C76B",
      fontWeight: "650",
    },
    ".lc-apl-editor-action-list-ref *": {
      color: "#F6C76B",
      fontWeight: "650",
    },
    ".lc-apl-editor-variable-ref--hover": {
      position: "relative",
      zIndex: "2",
      borderRadius: "4px",
      backgroundColor: "rgba(125, 211, 252, 0.14)",
      boxShadow:
        "0 0 0 1px rgba(125, 211, 252, 0.26), 0 8px 18px rgba(2, 8, 23, 0.32)",
      color: "#F8FAFC",
      cursor: "pointer",
      fontWeight: "700",
      textDecoration: "underline",
      textDecorationColor: "rgba(125, 211, 252, 0.9)",
      textUnderlineOffset: "0.18em",
    },
    ".lc-apl-editor-variable-ref--hover *": {
      color: "#F8FAFC",
      fontWeight: "700",
    },
    ".lc-apl-editor-action-list-ref--hover": {
      position: "relative",
      zIndex: "2",
      borderRadius: "4px",
      backgroundColor: "rgba(251, 191, 36, 0.16)",
      boxShadow:
        "0 0 0 1px rgba(251, 191, 36, 0.26), 0 8px 18px rgba(2, 8, 23, 0.32)",
      color: "#F8FAFC",
      cursor: "pointer",
      fontWeight: "700",
      textDecoration: "underline",
      textDecorationColor: "rgba(251, 191, 36, 0.9)",
      textUnderlineOffset: "0.18em",
    },
    ".lc-apl-editor-action-list-ref--hover *": {
      color: "#F8FAFC",
      fontWeight: "700",
    },
    ".lc-apl-editor-jump-target-line": {
      animation: "lc-apl-jump-target-fade 1.5s ease-out forwards",
      backgroundColor: "rgba(255, 255, 255, 0.62)",
    },
    ".lc-apl-editor-search-match": {
      borderRadius: "3px",
      backgroundColor: "rgba(250, 204, 21, 0.24)",
      boxShadow: "0 0 0 1px rgba(250, 204, 21, 0.18)",
    },
    ".lc-apl-editor-search-match--current": {
      backgroundColor: "rgba(34, 211, 238, 0.32)",
      boxShadow:
        "0 0 0 1px rgba(34, 211, 238, 0.55), 0 0 16px rgba(34, 211, 238, 0.18)",
    },
    "@keyframes lc-apl-jump-target-fade": {
      "0%": {
        backgroundColor: "rgba(255, 255, 255, 0.62)",
        boxShadow:
          "inset 0 0 0 1px rgba(255, 255, 255, 0.48), 0 0 24px rgba(255, 255, 255, 0.18)",
      },
      "100%": {
        backgroundColor: "rgba(255, 255, 255, 0)",
        boxShadow:
          "inset 0 0 0 1px rgba(255, 255, 255, 0), 0 0 0 rgba(255, 255, 255, 0)",
      },
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
