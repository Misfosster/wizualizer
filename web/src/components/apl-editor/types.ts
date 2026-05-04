import type { AplCompletionRuntimeContext } from "./completion";

export interface AplCodeEditorProps {
  value: string;
  parseErrorLineNumber: number | null;
  lineJumpRequest: AplEditorLineJumpRequest | null;
  completionContext: AplCompletionRuntimeContext;
  onPositionChange?: (position: AplEditorPosition) => void;
  onChange: (value: string) => void;
}

export interface AplEditorLineJumpRequest {
  lineNumber: number;
  requestId: number;
}

export interface AplEditorPosition {
  lineNumber: number;
  viewportFromLineNumber: number;
  viewportToLineNumber: number;
}
