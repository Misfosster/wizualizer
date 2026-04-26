export type AplDiagnosticSeverity = "error" | "warning";

export type AplDiagnosticCode =
  | "bad_action_assignment"
  | "malformed_action_segment"
  | "malformed_condition"
  | "malformed_sequence"
  | "semantic_warning"
  | "syntax_advisory"
  | "unexpected_trailing_token";

export interface AplDiagnostic {
  code: AplDiagnosticCode;
  message: string;
  lineNumber: number;
  lineText: string;
  severity: AplDiagnosticSeverity;
  suggestion?: string;
}

export class ParseDiagnosticError extends Error {
  readonly code: AplDiagnosticCode;
  readonly suggestion: string | undefined;

  constructor({
    code,
    message,
    suggestion,
  }: {
    code: AplDiagnosticCode;
    message: string;
    suggestion?: string;
  }) {
    super(message);
    this.name = "ParseDiagnosticError";
    this.code = code;
    this.suggestion = suggestion;
  }
}

export function createDiagnostic(
  diagnostic: AplDiagnostic,
): AplDiagnostic {
  return diagnostic;
}

export function parseErrorToDiagnostic(
  error: unknown,
  lineNumber: number,
  lineText: string,
  fallbackSuggestion?: string,
): AplDiagnostic {
  if (error instanceof ParseDiagnosticError) {
    return {
      code: error.code,
      message: error.message,
      lineNumber,
      lineText,
      severity: "error",
      suggestion: error.suggestion ?? fallbackSuggestion,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "malformed_action_segment",
    message,
    lineNumber,
    lineText,
    severity: "error",
    suggestion: fallbackSuggestion,
  };
}
