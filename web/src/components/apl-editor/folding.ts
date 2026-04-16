import { EditorState, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  codeFolding,
  foldGutter,
  foldKeymap,
  foldService,
} from "@codemirror/language";

const ACTION_CATEGORY_RE =
  /^\s*(actions(?:\.[A-Za-z0-9_.-]+)?)(?=(?:=|\+=\/|[+/]))/;
const GEAR_LINE_RE = /^\s*([A-Za-z0-9_]+)=/;
const PROFILE_HEADER_RE =
  /^\s*(?:copy|warrior|paladin|hunter|rogue|priest|deathknight|shaman|mage|warlock|monk|druid|demonhunter|evoker)="[^"]*"/;
const PROFILESET_LINE_RE = /^\s*profileset(?:\b|[.+=])/;

const GEAR_KEYS = new Set([
  "head",
  "neck",
  "shoulder",
  "back",
  "chest",
  "shirt",
  "tabard",
  "wrist",
  "hands",
  "waist",
  "legs",
  "feet",
  "finger1",
  "finger2",
  "trinket1",
  "trinket2",
  "main_hand",
  "off_hand",
]);

type FoldGroup = "gear" | "profileset" | `action:${string}`;

function getActionCategory(lineText: string): string | null {
  return ACTION_CATEGORY_RE.exec(lineText)?.[1] ?? null;
}

function getFoldGroup(lineText: string): FoldGroup | null {
  const actionCategory = getActionCategory(lineText);
  if (actionCategory) {
    return `action:${actionCategory}`;
  }

  if (PROFILESET_LINE_RE.test(lineText)) {
    return "profileset";
  }

  const gearKey = GEAR_LINE_RE.exec(lineText)?.[1];
  return gearKey && GEAR_KEYS.has(gearKey) ? "gear" : null;
}

function isProfileHeader(lineText: string): boolean {
  return PROFILE_HEADER_RE.test(lineText);
}

function isIgnorableBlockLine(lineText: string): boolean {
  const trimmed = lineText.trim();
  return trimmed === "" || trimmed.startsWith("#");
}

function createFoldMarker(open: boolean): HTMLElement {
  const marker = document.createElement("span");
  marker.className = [
    "lc-apl-editor-fold-marker",
    open
      ? "lc-apl-editor-fold-marker--open"
      : "lc-apl-editor-fold-marker--closed",
  ].join(" ");
  marker.setAttribute("aria-label", open ? "Collapse section" : "Expand section");
  marker.title = open ? "Collapse section" : "Expand section";
  return marker;
}

function hasPreviousLineInSameGroup(
  state: EditorState,
  lineNumber: number,
  group: FoldGroup,
): boolean {
  for (
    let previousLineNumber = lineNumber - 1;
    previousLineNumber >= 1;
    previousLineNumber--
  ) {
    const previousLine = state.doc.line(previousLineNumber);
    if (isIgnorableBlockLine(previousLine.text)) {
      continue;
    }

    return getFoldGroup(previousLine.text) === group;
  }

  return false;
}

function findGroupedBlockFold(
  state: EditorState,
  lineStart: number,
  lineEnd: number,
): { from: number; to: number } | null {
  const line = state.doc.lineAt(lineStart);
  const group = getFoldGroup(state.doc.sliceString(lineStart, lineEnd));
  if (!group || hasPreviousLineInSameGroup(state, line.number, group)) {
    return null;
  }

  let lastLine = line;
  for (
    let nextLineNumber = line.number + 1;
    nextLineNumber <= state.doc.lines;
    nextLineNumber++
  ) {
    const nextLine = state.doc.line(nextLineNumber);
    const nextText = nextLine.text;
    if (isIgnorableBlockLine(nextText)) {
      lastLine = nextLine;
      continue;
    }

    if (getFoldGroup(nextText) !== group) {
      break;
    }

    lastLine = nextLine;
  }

  return lastLine.number > line.number
    ? { from: line.to, to: lastLine.to }
    : null;
}

function findProfileFold(
  state: EditorState,
  lineStart: number,
  lineEnd: number,
): { from: number; to: number } | null {
  const line = state.doc.lineAt(lineStart);
  if (!isProfileHeader(state.doc.sliceString(lineStart, lineEnd))) {
    return null;
  }

  let lastLine = line;
  for (
    let nextLineNumber = line.number + 1;
    nextLineNumber <= state.doc.lines;
    nextLineNumber++
  ) {
    const nextLine = state.doc.line(nextLineNumber);
    if (isProfileHeader(nextLine.text)) {
      break;
    }

    lastLine = nextLine;
  }

  return lastLine.number > line.number
    ? { from: line.to, to: lastLine.to }
    : null;
}

function findAplFold(
  state: EditorState,
  lineStart: number,
  lineEnd: number,
): { from: number; to: number } | null {
  return (
    findGroupedBlockFold(state, lineStart, lineEnd) ??
    findProfileFold(state, lineStart, lineEnd)
  );
}

export function createAplFoldingExtension(): Extension[] {
  return [
    foldService.of(findAplFold),
    codeFolding({
      placeholderText: "...",
    }),
    foldGutter({
      markerDOM: createFoldMarker,
    }),
    keymap.of(foldKeymap),
  ];
}
