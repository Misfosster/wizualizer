import {
  EditorState,
  RangeSet,
  RangeSetBuilder,
  type Extension,
} from "@codemirror/state";
import {
  gutter,
  GutterMarker,
  keymap,
  ViewPlugin,
  type BlockInfo,
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

class AplFoldMarker extends GutterMarker {
  private readonly open: boolean;

  constructor(open: boolean) {
    super();
    this.open = open;
  }

  override eq(other: GutterMarker): boolean {
    return other instanceof AplFoldMarker && other.open === this.open;
  }

  override toDOM(): HTMLElement {
    return createFoldMarker(this.open);
  }
}

const canFoldMarker = new AplFoldMarker(true);
const canUnfoldMarker = new AplFoldMarker(false);

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

function buildFoldMarkers(view: EditorView): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>();

  for (const line of view.viewportLineBlocks) {
    const foldedRange = findFoldOnLine(view.state, line);
    const marker =
      foldedRange && isMultiLineRange(view.state, foldedRange)
        ? canUnfoldMarker
        : null;
    const foldRange =
      marker === null ? foldable(view.state, line.from, line.to) : null;
    const nextMarker =
      marker ??
      (foldRange && isMultiLineRange(view.state, foldRange)
        ? canFoldMarker
        : null);

    if (nextMarker) {
      builder.add(line.from, line.from, nextMarker);
    }
  }

  return builder.finish();
}

function createAplFoldGutter(): Extension {
  const markers = ViewPlugin.fromClass(
    class {
      markers: RangeSet<GutterMarker>;

      constructor(view: EditorView) {
        this.markers = buildFoldMarkers(view);
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.startState.field(foldState, false) !==
            update.state.field(foldState, false)
        ) {
          this.markers = buildFoldMarkers(update.view);
        }
      }
    },
  );

  return [
    markers,
    gutter({
      class: "cm-foldGutter",
      markers(view) {
        return view.plugin(markers)?.markers ?? RangeSet.empty;
      },
      initialSpacer() {
        return canUnfoldMarker;
      },
      domEventHandlers: {
        click(view, line) {
          const foldedRange = findFoldOnLine(view.state, line);
          if (foldedRange && isMultiLineRange(view.state, foldedRange)) {
            view.dispatch({ effects: unfoldEffect.of(foldedRange) });
            return true;
          }

          const foldRange = foldable(view.state, line.from, line.to);
          if (foldRange && isMultiLineRange(view.state, foldRange)) {
            view.dispatch({ effects: foldEffect.of(foldRange) });
            return true;
          }

          return false;
        },
      },
    }),
  ];
}

export function createAplFoldingExtension(): Extension[] {
  return [
    foldService.of(findAplFold),
    codeFolding({
      placeholderText: "...",
    }),
    createAplFoldGutter(),
    keymap.of(foldKeymap),
  ];
}
