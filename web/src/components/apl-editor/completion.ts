import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { Facet, type Extension } from "@codemirror/state";
import type { AplDocument, AplProfile } from "@/utils/apl-parser/document";
import type { SemanticSpecCatalog } from "@/utils/semantics/types";
import type { SemanticCatalogLookup } from "@/utils/semantics/validate";

export interface AplCompletionRuntimeContext {
  document: AplDocument | null;
  lookupSemanticSpec?: SemanticCatalogLookup;
}

export const aplCompletionContextFacet =
  Facet.define<AplCompletionRuntimeContext, AplCompletionRuntimeContext>({
    combine(values) {
      return values[0] ?? { document: null };
    },
  });

const MAX_COMPLETIONS = 40;

const ACTION_LIST_STARTS: readonly Completion[] = [
  { label: "actions", type: "keyword", apply: "actions" },
  {
    label: "actions.precombat",
    type: "keyword",
    apply: "actions.precombat",
  },
];

const STRUCTURAL_ACTIONS: readonly Completion[] = [
  { label: "auto_attack", type: "function" },
  { label: "call_action_list", type: "function" },
  { label: "run_action_list", type: "function" },
  { label: "variable", type: "function" },
  { label: "cycling_variable", type: "function" },
  { label: "sequence", type: "function" },
  { label: "strict_sequence", type: "function" },
  { label: "use_item", type: "function" },
  { label: "use_items", type: "function" },
];

const SEGMENT_KEYS: readonly Completion[] = [
  { label: "if", type: "property", apply: "if=" },
  { label: "target_if", type: "property", apply: "target_if=" },
  { label: "name", type: "property", apply: "name=" },
  { label: "value", type: "property", apply: "value=" },
  { label: "op", type: "property", apply: "op=" },
  { label: "slot", type: "property", apply: "slot=" },
  { label: "slots", type: "property", apply: "slots=" },
  { label: "line_cd", type: "property", apply: "line_cd=" },
  { label: "use_off_gcd", type: "property", apply: "use_off_gcd=" },
  { label: "chain", type: "property", apply: "chain=" },
];

const OPERATOR_COMPLETIONS: readonly Completion[] = [
  { label: "&", type: "operator" },
  { label: "|", type: "operator" },
  { label: ">=", type: "operator" },
  { label: "<=", type: "operator" },
  { label: "!=", type: "operator" },
  { label: "=", type: "operator" },
];

const ACTION_LIST_ASSIGNMENT_VALID_FOR = /^[+=/]*$/;

interface CompletionInput {
  text: string;
  lineNumber: number;
  column: number;
  document: AplDocument | null;
  lookupSemanticSpec?: SemanticCatalogLookup;
}

export function createAplCompletionExtension(): Extension {
  return autocompletion({
    activateOnTyping: true,
    maxRenderedOptions: MAX_COMPLETIONS,
    override: [aplCompletionSource],
  });
}

export function createAplCompletionContextExtension(
  context: AplCompletionRuntimeContext,
): Extension {
  return aplCompletionContextFacet.of(context);
}

export function getAplCompletionsForLine({
  text,
  lineNumber,
  column,
  document,
  lookupSemanticSpec,
}: CompletionInput): CompletionResult | null {
  const lines = text.split("\n");
  const line = lines[lineNumber - 1] ?? "";
  const lineBefore = line.slice(0, column);
  if (isInsideComment(lineBefore)) {
    return null;
  }

  const activeProfile = getProfileForLine(document, lineNumber);
  const semanticCatalog = getSemanticCatalogForProfile(
    activeProfile,
    lookupSemanticSpec,
  );
  const word = getCurrentWord(lineBefore);
  const from = documentOffset(lines, lineNumber, column - word.length);

  const actionListOperatorCompletion = getActionListOperatorCompletion({
    text,
    lineBefore,
    lineNumber,
    column,
    lines,
  });
  if (actionListOperatorCompletion) {
    return actionListOperatorCompletion;
  }

  if (/^\s*act[A-Za-z0-9_.-]*$/.test(lineBefore)) {
    return completionResult(from, [
      ...ACTION_LIST_STARTS,
      ...getActionListCompletions(document),
    ]);
  }

  if (isVariableReferenceContext(lineBefore)) {
    return completionResult(
      from,
      getVariableCompletions(text, lineNumber, activeProfile),
    );
  }

  const namespaceCompletions = getNamespaceCompletions(
    lineBefore,
    semanticCatalog,
  );
  if (namespaceCompletions) {
    return completionResult(from, namespaceCompletions);
  }

  if (isActionNameContext(lineBefore)) {
    return completionResult(
      from,
      getActionNameCompletions(text, lineNumber, semanticCatalog),
    );
  }

  if (isActionListNameContext(lineBefore)) {
    return completionResult(
      from,
      getActionListCompletions(document, activeProfile),
    );
  }

  if (isSegmentKeyContext(lineBefore)) {
    return completionResult(from, SEGMENT_KEYS);
  }

  if (/[&|!<>=]$/.test(lineBefore)) {
    return completionResult(
      documentOffset(lines, lineNumber, column),
      OPERATOR_COMPLETIONS,
    );
  }

  return null;
}

interface ActionListOperatorCompletionInput {
  text: string;
  lineBefore: string;
  lineNumber: number;
  column: number;
  lines: readonly string[];
}

function getActionListOperatorCompletion({
  text,
  lineBefore,
  lineNumber,
  column,
  lines,
}: ActionListOperatorCompletionInput): CompletionResult | null {
  const context = getActionListOperatorContext(lineBefore);
  if (!context) {
    return null;
  }
  if (context.operator !== "+" && context.operator !== "+=") {
    return null;
  }

  const recommendedOperator = hasPriorOwnedActionListCall(
    text,
    lineNumber,
    context.blockName,
  )
    ? "+=/"
    : "=";

  return completionResult(
    documentOffset(lines, lineNumber, context.operatorStartColumn),
    [{ label: recommendedOperator, type: "operator", apply: recommendedOperator }],
    documentOffset(lines, lineNumber, column),
    ACTION_LIST_ASSIGNMENT_VALID_FOR,
  );
}

interface ActionListOperatorContext {
  blockName: string;
  operator: string;
  operatorStartColumn: number;
}

function getActionListOperatorContext(
  lineBefore: string,
): ActionListOperatorContext | null {
  const match =
    /^(?<indent>\s*)(?<blockName>actions(?:\.[A-Za-z0-9_.-]*)?)(?<operator>\+=\/?|\+|=)$/.exec(
      lineBefore,
    );
  const blockName = match?.groups?.blockName;
  const operator = match?.groups?.operator;
  if (!blockName || !operator) {
    return null;
  }

  return {
    blockName,
    operator,
    operatorStartColumn: (match.groups?.indent ?? "").length + blockName.length,
  };
}

function hasPriorOwnedActionListCall(
  text: string,
  lineNumber: number,
  blockName: string,
): boolean {
  const seenInCurrentProfile = new Set<string>();
  const lines = text.split("\n");
  for (let index = 0; index < lineNumber - 1; index++) {
    const line = (lines[index] ?? "").trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    if (isProfileBoundary(line)) {
      seenInCurrentProfile.clear();
      continue;
    }
    const actionBlockName = parseActionBlockName(line);
    if (actionBlockName) {
      seenInCurrentProfile.add(actionBlockName);
    }
  }
  return seenInCurrentProfile.has(blockName);
}

function isProfileBoundary(line: string): boolean {
  return /^(?:warrior|paladin|hunter|rogue|priest|deathknight|death_knight|shaman|mage|warlock|monk|druid|demonhunter|demon_hunter|evoker|copy)="[^"]+"$/.test(
    line,
  );
}

function parseActionBlockName(line: string): string | null {
  return /^actions(?:\.[A-Za-z0-9_.-]*)?(?=\s*(?:=|\+=\/))/.exec(line)?.[0] ?? null;
}

function aplCompletionSource(
  context: CompletionContext,
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const runtimeContext = context.state.facet(aplCompletionContextFacet);
  return getAplCompletionsForLine({
    text: context.state.doc.toString(),
    lineNumber: line.number,
    column: context.pos - line.from,
    document: runtimeContext.document,
    lookupSemanticSpec: runtimeContext.lookupSemanticSpec,
  });
}

function completionResult(
  from: number,
  options: readonly Completion[],
  to?: number,
  validFor = /^[A-Za-z0-9_.-]*$/,
): CompletionResult | null {
  const unique = dedupeCompletions(options).slice(0, MAX_COMPLETIONS);
  if (unique.length === 0) {
    return null;
  }

  return {
    from,
    ...(to !== undefined ? { to } : {}),
    options: unique,
    validFor,
  };
}

function getCurrentWord(lineBefore: string): string {
  return /[A-Za-z0-9_.-]*$/.exec(lineBefore)?.[0] ?? "";
}

function isInsideComment(lineBefore: string): boolean {
  return lineBefore.includes("#");
}

function isActionNameContext(lineBefore: string): boolean {
  return /actions(?:\.[A-Za-z0-9_.-]+)?(?:=|\+=\/)[A-Za-z0-9_.-]*$/.test(
    lineBefore.trimStart(),
  );
}

function isSegmentKeyContext(lineBefore: string): boolean {
  const lastComma = lineBefore.lastIndexOf(",");
  if (lastComma === -1) {
    return false;
  }
  const segmentStart = lineBefore.slice(lastComma + 1);
  return /^[A-Za-z0-9_]*$/.test(segmentStart);
}

function isActionListNameContext(lineBefore: string): boolean {
  return /(?:call_action_list|run_action_list),[^#]*name=[A-Za-z0-9_.-]*$/.test(
    lineBefore,
  );
}

function isVariableReferenceContext(lineBefore: string): boolean {
  return /(?:^|[^A-Za-z0-9_.-])variable\.[A-Za-z0-9_.-]*$/.test(lineBefore);
}

function getProfileForLine(
  document: AplDocument | null,
  lineNumber: number,
): AplProfile | null {
  if (!document) {
    return null;
  }

  let activeProfile: AplProfile | null = null;
  for (const profile of document.profiles) {
    let firstOwnedLine: number | null = null;
    for (const block of profile.blocks) {
      for (const actionLine of block.actions) {
        if (actionLine.isInherited) {
          continue;
        }
        if (
          firstOwnedLine === null ||
          actionLine.lineNumber < firstOwnedLine
        ) {
          firstOwnedLine = actionLine.lineNumber;
        }
      }
    }
    if (firstOwnedLine === null || firstOwnedLine > lineNumber) {
      continue;
    }
    activeProfile = profile;
  }
  return activeProfile;
}

function getActionListCompletions(
  document: AplDocument | null,
  profile?: AplProfile | null,
): readonly Completion[] {
  if (!document) {
    return [];
  }

  const profiles = profile ? [profile] : document.profiles;
  const names = new Set<string>();
  for (const currentProfile of profiles) {
    for (const block of currentProfile.blocks) {
      names.add(block.name);
    }
  }

  return Array.from(names)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ label: name, type: "keyword" }));
}

function getSemanticCatalogForProfile(
  profile: AplProfile | null,
  lookupSemanticSpec: SemanticCatalogLookup | undefined,
): SemanticSpecCatalog | null {
  if (!profile?.specName || !lookupSemanticSpec) {
    return null;
  }

  const lookup = lookupSemanticSpec(profile.className, profile.specName);
  return lookup.status === "loaded" && lookup.catalog ? lookup.catalog : null;
}

function getActionNameCompletions(
  text: string,
  lineNumber: number,
  catalog: SemanticSpecCatalog | null,
): readonly Completion[] {
  const frequencies = getActionFrequencies(text, lineNumber);
  const byLabel = new Map<string, Completion>();

  for (const option of STRUCTURAL_ACTIONS) {
    addCompletionCandidate(byLabel, option);
  }
  for (const action of catalog?.actions ?? []) {
    addCompletionCandidate(byLabel, { label: action, type: "function" });
  }
  for (const action of frequencies.keys()) {
    addCompletionCandidate(byLabel, { label: action, type: "function" });
  }

  return Array.from(byLabel.values())
    .map((option) => applyActionPopularityBoost(option, frequencies))
    .sort(
      (left, right) =>
        (frequencies.get(right.label) ?? 0) -
        (frequencies.get(left.label) ?? 0),
    );
}

function addCompletionCandidate(
  byLabel: Map<string, Completion>,
  option: Completion,
): void {
  if (!byLabel.has(option.label)) {
    byLabel.set(option.label, option);
  }
}

function applyActionPopularityBoost(
  option: Completion,
  frequencies: ReadonlyMap<string, number>,
): Completion {
  const frequency = frequencies.get(option.label) ?? 0;
  if (frequency === 0) {
    return option;
  }
  return {
    ...option,
    boost: Math.min(99, frequency * 10),
  };
}

function getActionFrequencies(
  text: string,
  currentLineNumber: number,
): ReadonlyMap<string, number> {
  const frequencies = new Map<string, number>();
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (index + 1 === currentLineNumber) {
      continue;
    }

    for (const action of getActionNamesFromLine(lines[index] ?? "")) {
      frequencies.set(action, (frequencies.get(action) ?? 0) + 1);
    }
  }
  return frequencies;
}

function getActionNamesFromLine(line: string): readonly string[] {
  const lineWithoutComment = line.split("#", 1)[0] ?? "";
  const payload =
    /^\s*actions(?:\.[A-Za-z0-9_.-]+)?(?:=|\+=\/)(.+)$/.exec(
      lineWithoutComment,
    )?.[1] ?? null;
  if (!payload) {
    return [];
  }

  const action = parseActionName(payload);
  if (!action) {
    return [];
  }

  if (action !== "sequence" && action !== "strict_sequence") {
    return [action];
  }

  const firstComma = payload.indexOf(",");
  if (firstComma === -1) {
    return [action];
  }

  return [
    action,
    ...payload
      .slice(firstComma + 1)
      .split(":")
      .filter((entry) => !/^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(entry))
      .map((entry) => parseActionName(entry))
      .filter((entry): entry is string => entry !== null),
  ];
}

function parseActionName(value: string): string | null {
  return /^[\s]*([A-Za-z0-9_.-]+)/.exec(value)?.[1]?.toLowerCase() ?? null;
}

function getNamespaceCompletions(
  lineBefore: string,
  catalog: SemanticSpecCatalog | null,
): readonly Completion[] | null {
  if (!catalog) {
    return null;
  }

  const match =
    /(?:^|[^A-Za-z0-9_.-])(talent|buff|debuff|cooldown|dot)\.[A-Za-z0-9_.-]*$/.exec(
      lineBefore,
    );
  const namespace = match?.[1];
  if (!namespace) {
    return null;
  }

  const values = getNamespaceValues(namespace, catalog);
  return values.map((value) => ({
    label: getNamespaceAtom(namespace, value),
    type: namespace === "talent" ? "constant" : "variable",
  }));
}

function getNamespaceValues(
  namespace: string,
  catalog: SemanticSpecCatalog,
): readonly string[] {
  switch (namespace) {
    case "talent":
      return catalog.talents;
    case "buff":
      return catalog.buffs;
    case "debuff":
      return catalog.debuffs;
    case "cooldown":
      return catalog.cooldowns;
    case "dot":
      return catalog.dots;
    default:
      return [];
  }
}

function getNamespaceAtom(namespace: string, value: string): string {
  switch (namespace) {
    case "talent":
      return `talent.${value}.enabled`;
    case "buff":
    case "debuff":
      return `${namespace}.${value}.up`;
    case "cooldown":
      return `cooldown.${value}.ready`;
    case "dot":
      return `dot.${value}.ticking`;
    default:
      return `${namespace}.${value}`;
  }
}

function getVariableCompletions(
  text: string,
  lineNumber: number,
  activeProfile: AplProfile | null,
): readonly Completion[] {
  const lines = text.split("\n");
  const variables = new Set<string>();
  const activeProfileName = activeProfile?.name ?? null;
  let currentProfileName: string | null = null;

  for (let index = 0; index < lines.length; index++) {
    const currentLineNumber = index + 1;
    if (currentLineNumber >= lineNumber) {
      break;
    }

    const line = lines[index] ?? "";
    const profileName = parseProfileName(line);
    if (profileName !== null) {
      currentProfileName = profileName;
    }
    if (
      activeProfileName !== null &&
      currentProfileName !== null &&
      currentProfileName !== activeProfileName
    ) {
      continue;
    }

    const variableName = parseVariableDefinitionName(line);
    if (variableName) {
      variables.add(variableName);
    }
  }

  return Array.from(variables)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ label: `variable.${name}`, type: "variable" }));
}

function parseProfileName(line: string): string | null {
  return /^(?:warrior|paladin|hunter|rogue|priest|deathknight|shaman|mage|warlock|monk|druid|demonhunter|evoker|copy)="([^"]+)"$/.exec(
    line.trim(),
  )?.[1] ?? null;
}

function parseVariableDefinitionName(line: string): string | null {
  if (
    !/^\s*actions(?:\.[A-Za-z0-9_.-]+)?(?:=|\+=\/)(?:variable|cycling_variable)(?:,|$)/.test(
      line,
    )
  ) {
    return null;
  }
  return /(?:^|,)name=([^,\s]+)/.exec(line)?.[1] ?? null;
}

function documentOffset(
  lines: readonly string[],
  lineNumber: number,
  column: number,
): number {
  let offset = 0;
  for (let index = 0; index < lineNumber - 1; index++) {
    offset += (lines[index] ?? "").length + 1;
  }
  return offset + column;
}

function dedupeCompletions(options: readonly Completion[]): Completion[] {
  const seen = new Set<string>();
  const result: Completion[] = [];
  for (const option of options) {
    if (seen.has(option.label)) {
      continue;
    }
    seen.add(option.label);
    result.push(option);
  }
  return result;
}
