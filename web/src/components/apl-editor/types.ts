import type { AplCompletionRuntimeContext } from "./completion";

export interface AplCodeEditorProps {
  value: string;
  parseErrorLineNumber: number | null;
  lineJumpRequest: AplEditorLineJumpRequest | null;
  completionContext: AplCompletionRuntimeContext;
  onChange: (value: string) => void;
}

export interface AplEditorLineJumpRequest {
  lineNumber: number;
  requestId: number;
}
