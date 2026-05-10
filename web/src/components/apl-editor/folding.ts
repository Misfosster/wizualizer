import { EditorState, type Extension, Range } from "@codemirror/state";
import {
  Decoration,
  ViewPlugin,
  WidgetType,
  keymap,
  type BlockInfo,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import {
  codeFolding,
  foldEffect,
  foldKeymap,
  foldService,
  foldState,
  foldable,
  foldedRanges,
  unfoldEffect,
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

  // Walk forward through the section. Blank/comment lines do not by
  // themselves extend the fold: they are "in the section" only when another
  // same-group line follows them. Trailing whitespace and the comment header
  // for the next section therefore stay outside this fold and remain
  // visible, which matches the convention that a comment immediately above a
  // block belongs to the block it precedes.
  let lastLine = line;
  for (
    let nextLineNumber = line.number + 1;
    nextLineNumber <= state.doc.lines;
    nextLineNumber++
  ) {
    const nextLine = state.doc.line(nextLineNumber);
    const nextText = nextLine.text;
    if (isIgnorableBlockLine(nextText)) {
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

  // Same convention as `findGroupedBlockFold`: trailing blank lines and
  // section-header comments that precede the next profile belong to the next
  // profile, not this one. We extend `lastLine` only on real content lines.
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
    if (isIgnorableBlockLine(nextLine.text)) {
      continue;
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

function isMultiLineRange(
  state: EditorState,
  range: { from: number; to: number },
): boolean {
  return state.doc.lineAt(range.to).number > state.doc.lineAt(range.from).number;
}

function findFoldOnLine(
  state: EditorState,
  line: BlockInfo,
): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  foldedRanges(state).between(line.from, line.to, (from, to) => {
    if (!found || found.from > from) {
      found = { from, to };
    }
  });
  return found;
}

type FoldLineControl = "fold" | "unfold";

/**
 * Fold chevrons belong only on the header / parent line of a fold (the line
 * {@link findAplFold} starts from). Continuation lines such as `actions.*+=`
 * must not get a widget or they shift the code in and look misaligned.
 */
function isFoldBlockParentLine(state: EditorState, line: BlockInfo): boolean {
  const text = state.doc.sliceString(line.from, line.to);
  if (isProfileHeader(text)) {
    return true;
  }

  const group = getFoldGroup(text);
  if (!group) {
    return false;
  }

  return !hasPreviousLineInSameGroup(state, state.doc.lineAt(line.from).number, group);
}

function getFoldControlForLine(
  view: EditorView,
  line: BlockInfo,
): FoldLineControl | null {
  const foldedRange = findFoldOnLine(view.state, line);
  const unfolded =
    foldedRange && isMultiLineRange(view.state, foldedRange)
      ? ("unfold" as const)
      : null;
  if (unfolded) {
    return "unfold";
  }

  const foldRange = foldable(view.state, line.from, line.to);
  if (foldRange && isMultiLineRange(view.state, foldRange)) {
    return isFoldBlockParentLine(view.state, line) ? "fold" : null;
  }

  return null;
}

function dispatchFoldClick(view: EditorView, lineFrom: number): boolean {
  const lineBlock = view.lineBlockAt(lineFrom);
  const foldedRange = findFoldOnLine(view.state, lineBlock);
  if (foldedRange && isMultiLineRange(view.state, foldedRange)) {
    view.dispatch({ effects: unfoldEffect.of(foldedRange) });
    return true;
  }

  const foldRange = foldable(view.state, lineBlock.from, lineBlock.to);
  if (foldRange && isMultiLineRange(view.state, foldRange)) {
    view.dispatch({ effects: foldEffect.of(foldRange) });
    return true;
  }

  return false;
}

class FoldLeadWidget extends WidgetType {
  private readonly lineFrom: number;
  private readonly foldOpenChevron: boolean;

  constructor(lineFrom: number, foldOpenChevron: boolean) {
    super();
    this.lineFrom = lineFrom;
    this.foldOpenChevron = foldOpenChevron;
  }

  override eq(other: WidgetType): boolean {
    return (
      other instanceof FoldLeadWidget &&
      other.lineFrom === this.lineFrom &&
      other.foldOpenChevron === this.foldOpenChevron
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "lc-apl-editor-fold-lead-wrap";

    const marker = createFoldMarker(this.foldOpenChevron);
    marker.classList.add("lc-apl-editor-fold-marker--lead-strip");
    marker.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void dispatchFoldClick(view, this.lineFrom);
    });
    wrap.appendChild(marker);
    return wrap;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

function buildFoldLeadDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  for (const line of view.viewportLineBlocks) {
    const control = getFoldControlForLine(view, line);
    if (!control) {
      continue;
    }

    const foldOpenChevron = control === "fold";
    ranges.push(
      Decoration.widget({
        widget: new FoldLeadWidget(line.from, foldOpenChevron),
        side: -1,
      }).range(line.from),
    );
  }

  ranges.sort((a, b) => a.from - b.from);
  return Decoration.set(ranges, true);
}

function createFoldLeadDecorations(): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildFoldLeadDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.startState.field(foldState, false) !==
            update.state.field(foldState, false)
        ) {
          this.decorations = buildFoldLeadDecorations(update.view);
        }
      }
    },
    { decorations: (value) => value.decorations },
  );

  return plugin;
}

export function createAplFoldingExtension(): Extension[] {
  return [
    foldService.of(findAplFold),
    codeFolding({
      placeholderText: "...",
    }),
    createFoldLeadDecorations(),
    keymap.of(foldKeymap),
  ];
}
