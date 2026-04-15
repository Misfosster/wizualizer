export interface AplCodeEditorProps {
  value: string;
  parseErrorLineNumber: number | null;
  onChange: (value: string) => void;
}
