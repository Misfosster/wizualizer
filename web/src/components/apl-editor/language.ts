import {
  StreamLanguage,
  type StringStream,
} from "@codemirror/language";

interface AplStreamState {
  inActionLine: boolean;
  expectActionName: boolean;
  sawActionName: boolean;
  expectSegmentKey: boolean;
}

const APL_CLASS_KEYS = new Set([
  "warrior",
  "paladin",
  "hunter",
  "rogue",
  "priest",
  "deathknight",
  "shaman",
  "mage",
  "warlock",
  "monk",
  "druid",
  "demonhunter",
  "evoker",
  "copy",
]);

const SEGMENT_KEYS = new Set([
  "if",
  "target_if",
  "name",
  "value",
  "op",
  "slot",
  "slots",
  "line_cd",
  "use_off_gcd",
  "chain",
]);

const IDENT_RE =
  /(?:[A-Za-z_][A-Za-z0-9_.]*|[0-9]+[A-Za-z_][A-Za-z0-9_.]*)/;
const ACTION_CATEGORY_RE = /actions(?:\.[A-Za-z0-9_.-]+)?(?=(?:\+=\/|=))/;
const NUMBER_RE = /[0-9]+(?:\.[0-9]+)?(?![A-Za-z_])/;

function createStartState(): AplStreamState {
  return {
    inActionLine: false,
    expectActionName: false,
    sawActionName: false,
    expectSegmentKey: false,
  };
}

function resetLineState(state: AplStreamState, line: string): void {
  state.inActionLine = /^\s*actions(?:\.|=|\+=\/)/.test(line);
  state.expectActionName = false;
  state.sawActionName = false;
  state.expectSegmentKey = false;
}

function nextNonSpace(stream: StringStream): string | undefined {
  const match = /\S/.exec(stream.string.slice(stream.pos));
  return match?.[0];
}

export const aplLanguage = StreamLanguage.define<AplStreamState>({
  name: "apl",
  startState: createStartState,
  blankLine(state) {
    resetLineState(state, "");
  },
  token(stream, state) {
    if (stream.sol()) {
      resetLineState(state, stream.string);
    }

    if (stream.eatSpace()) {
      return null;
    }

    if (stream.match(/#[^\n]*/)) {
      return "comment";
    }

    if (stream.match(/"[^"]*"?/)) {
      return "string";
    }

    if (stream.match(ACTION_CATEGORY_RE)) {
      state.inActionLine = true;
      return "namespace";
    }

    if (stream.match("+=/")) {
      state.expectActionName = true;
      return "updateOperator";
    }

    if (stream.match("+=")) {
      if (state.inActionLine && !state.sawActionName) {
        state.expectActionName = true;
      }

      return "updateOperator";
    }

    if (stream.match("=")) {
      if (state.inActionLine && !state.sawActionName) {
        state.expectActionName = true;
      }

      return "definitionOperator";
    }

    if (stream.match(/(?:!=|==|!~|<\?|>\?|<=|>=|<|>|~)/)) {
      return "compareOperator";
    }

    if (stream.match(/[&|^!@]/)) {
      return "logicOperator";
    }

    if (stream.match(/(?:%%|[+\-*/%])/)) {
      return "arithmeticOperator";
    }

    if (stream.match(/[()]/)) {
      return "paren";
    }

    if (stream.match(/[,:]/)) {
      state.expectSegmentKey = true;
      return "punctuation";
    }

    if (stream.match(NUMBER_RE)) {
      return "number";
    }

    if (stream.match(IDENT_RE)) {
      const token = stream.current();
      const next = nextNonSpace(stream);

      if (state.expectActionName) {
        state.expectActionName = false;
        state.sawActionName = true;
        return "tagName";
      }

      if (
        next === "=" &&
        (state.expectSegmentKey || SEGMENT_KEYS.has(token))
      ) {
        state.expectSegmentKey = false;
        return "attributeName";
      }

      if (stream.start === 0 && next === "=" && APL_CLASS_KEYS.has(token)) {
        return "keyword";
      }

      if (stream.start === 0 && next === "=") {
        return "attributeName";
      }

      state.expectSegmentKey = false;
      return "variableName";
    }

    stream.next();
    return null;
  },
});
