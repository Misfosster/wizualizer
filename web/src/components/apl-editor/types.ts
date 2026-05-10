import type { AplCompletionRuntimeContext } from "./completion";

export interface AplCodeEditorProps {
  value: string;
  parseErrorLineNumber: number | null;
  lineJumpRequest: AplEditorLineJumpRequest | null;
  completionContext: AplCompletionRuntimeContext;
  /** Ctrl/Cmd+click a line number in the gutter to focus that action on the graph preview. */
  onCtrlClickLineNumber?: (lineNumber: number) => void;
  onChange: (value: string) => void;
}

export interface AplEditorLineJumpRequest {
  lineNumber: number;
  requestId: number;
}
