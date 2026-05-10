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
      "--apl-fold-channel": "1.125rem",
      /* Breathing room between editor edge and line numbers (also helps fold chevron read as “content-adjacent”) */
      "--apl-gutter-inset-inline-start": "0.5rem",
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
      padding: "0.75rem 0 0.75rem 2px",
      caretColor: "#A5F3FC",
    },
    ".cm-line": {
      position: "relative",
      padding: "0 1rem 0 var(--apl-fold-channel)",
    },
    ".cm-gutters": {
      borderRight: "1px solid rgba(148, 163, 184, 0.14)",
      backgroundColor: "#0F141D",
      color: "#657286",
      minHeight: "56vh",
      paddingLeft: "var(--apl-gutter-inset-inline-start)",
      transition:
        "padding-right 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
    },
    ".cm-gutter": {
      minHeight: "56vh",
    },
    ".cm-lineNumbers": {
      userSelect: "none",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "1.75rem",
      padding: "0 0.4rem 0 0.35rem",
      cursor: "default",
      userSelect: "none",
      borderRadius: "6px",
      margin: "0 1px",
      transition:
        "color 140ms ease, font-weight 140ms ease, background-color 120ms ease, box-shadow 120ms ease",
    },
    "&.lc-apl-editor--jump-modifier .cm-lineNumbers .cm-gutterElement:hover": {
      backgroundColor: "rgba(125, 211, 252, 0.14)",
      color: "#E2EAF4",
      boxShadow:
        "inset 0 0 0 1px rgba(125, 211, 252, 0.28), 0 1px 2px rgba(0, 0, 0, 0.2)",
    },
    "&.lc-apl-editor--jump-modifier .cm-gutters": {
      borderRightColor: "rgba(125, 211, 252, 0.22)",
      boxShadow:
        "6px 0 18px rgba(0, 0, 0, 0.35), inset -1px 0 0 rgba(125, 211, 252, 0.12)",
      paddingRight: "4px",
      zIndex: "2",
      position: "relative",
    },
    "&.lc-apl-editor--jump-modifier .cm-lineNumbers .cm-gutterElement": {
      cursor: "pointer",
      color: "#D6E3F0",
      fontWeight: "600",
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: "3px",
      paddingLeft: "0.4rem",
      paddingRight: "0.4rem",
    },
    "&.lc-apl-editor--jump-modifier .cm-lineNumbers .cm-gutterElement::after": {
      content: '"\u2192"',
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto",
      fontSize: "11px",
      lineHeight: "1",
      fontWeight: "700",
      opacity: "1",
      color: "#D6E3F0",
      pointerEvents: "none",
    },
    "&.lc-apl-editor--jump-modifier .cm-lineNumbers .cm-gutterElement:hover::after": {
      color: "#F8FAFC",
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
    ".lc-apl-editor-fold-lead-wrap": {
      display: "inline-block",
      width: "0",
      maxWidth: "0",
      overflow: "visible",
      position: "relative",
      verticalAlign: "top",
      margin: "0",
      padding: "0",
      fontSize: "0",
      lineHeight: "0",
      userSelect: "none",
    },
    ".lc-apl-editor-fold-marker--lead-strip": {
      position: "absolute",
      left: "calc(-1 * var(--apl-fold-channel))",
      top: "0",
      zIndex: "1",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      height: "1.45em",
      margin: "0",
      cursor: "pointer",
      fontSize: "13px",
      lineHeight: "1",
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
