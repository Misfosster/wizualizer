export interface AplCodeEditorProps {
  value: string;
  parseErrorLineNumber: number | null;
  lineJumpRequest: AplEditorLineJumpRequest | null;
  onChange: (value: string) => void;
}

export interface AplEditorLineJumpRequest {
  lineNumber: number;
  requestId: number;
}
