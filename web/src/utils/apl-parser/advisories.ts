import {
  createDiagnostic,
  type AplDiagnostic,
} from "./diagnostics";

interface AdvisoryRule {
  pattern: RegExp;
  message: string;
  suggestion: string;
}

const ACTION_ASSIGNMENT_RE = /^actions(?:\.[A-Za-z0-9_.-]*)?/;

const ADVISORY_RULES: readonly AdvisoryRule[] = [
  {
    pattern: /(^|,)iff\s*=/,
    message: "Unknown segment key 'iff'.",
    suggestion: "Use if= instead of iff=.",
  },
  {
    pattern: /(^|,)traget_if\s*=/,
    message: "Unknown segment key 'traget_if'.",
    suggestion: "Use target_if= instead of traget_if=.",
  },
  {
    pattern: /&&/,
    message: "SimC conditions use a single ampersand for AND.",
    suggestion: "Use & instead of &&.",
  },
  {
    pattern: /\|\|/,
    message: "SimC conditions use a single pipe for OR.",
    suggestion: "Use | instead of ||.",
  },
  {
    pattern: /=>/,
    message: "Comparison operator is reversed.",
    suggestion: "Use >= instead of =>.",
  },
  {
    pattern: /=</,
    message: "Comparison operator is reversed.",
    suggestion: "Use <= instead of =<.",
  },
];

export function getActionLineAdvisories(
  rawLine: string,
  lineNumber: number,
): readonly AplDiagnostic[] {
  const lineText = rawLine;
  const line = stripInlineComment(rawLine).trim();
  if (!line || line.startsWith("#")) {
    return [];
  }

  const diagnostics: AplDiagnostic[] = [];
  const assignmentSuggestion = getAssignmentSuggestion(line);
  if (assignmentSuggestion) {
    diagnostics.push(
      createDiagnostic({
        code: "syntax_advisory",
        message: "Suspicious action assignment syntax.",
        lineNumber,
        lineText,
        severity: "warning",
        suggestion: assignmentSuggestion,
      }),
    );
  }

  for (const rule of ADVISORY_RULES) {
    if (!rule.pattern.test(line)) {
      continue;
    }
    diagnostics.push(
      createDiagnostic({
        code: "syntax_advisory",
        message: rule.message,
        lineNumber,
        lineText,
        severity: "warning",
        suggestion: rule.suggestion,
      }),
    );
  }

  return diagnostics;
}

function getAssignmentSuggestion(line: string): string | undefined {
  const actionPrefix = ACTION_ASSIGNMENT_RE.exec(line)?.[0];
  if (!actionPrefix) {
    return undefined;
  }

  const rest = line.slice(actionPrefix.length);
  if (/^\+=\s*[^/]/.test(rest)) {
    return "Use +=/ when appending an action, for example actions+=/spell.";
  }
  if (rest.startsWith("+/")) {
    return "Use +=/ instead of +/ when appending an action.";
  }
  if (rest.startsWith("=/") && rest.length > 2) {
    return "Use actions=spell to replace a list, or actions+=/spell to append.";
  }
  return undefined;
}

function stripInlineComment(rawLine: string): string {
  const commentIndex = rawLine.indexOf("#");
  return commentIndex === -1 ? rawLine : rawLine.slice(0, commentIndex);
}
