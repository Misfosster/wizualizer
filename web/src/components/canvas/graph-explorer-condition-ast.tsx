import { prettyCond } from "@/utils/apl-parser/pretty-log";
import type { Condition } from "@/utils/apl-parser/types";
import type { ReactNode } from "react";

interface ConditionAstTreeProps {
  expr: Condition;
}

export function ConditionAstTree({ expr }: ConditionAstTreeProps) {
  return (
    <div className="mt-1 rounded border border-gray-200 bg-gray-50/70 p-1.5">
      <ConditionAstNode expr={expr} path="root" depth={0} />
    </div>
  );
}

function ConditionAstNode({
  expr,
  path,
  depth,
}: {
  expr: Condition;
  path: string;
  depth: number;
}) {
  switch (expr.kind) {
    case "ident":
      return <LeafNode label={`ident: ${expr.name}`} />;
    case "number":
      return <LeafNode label={`number: ${String(expr.value)}`} />;
    case "sequence":
      return (
        <BranchNode title={`sequence (${String(expr.expr.length)} items)`} defaultOpen={depth < 1}>
          <ul className="m-0 mt-1 list-none space-y-1 p-0 pl-3">
            {expr.expr.map((entry, index) => (
              <li key={`${path}:seq:${String(index)}`}>
                <LeafNode label={`ident: ${entry.name}`} />
              </li>
            ))}
          </ul>
        </BranchNode>
      );
    case "call":
      return (
        <BranchNode title={`call: ${expr.name}(${String(expr.args.length)} args)`} defaultOpen={depth < 1}>
          <ul className="m-0 mt-1 list-none space-y-1 p-0 pl-3">
            {expr.args.map((arg, index) => (
              <li key={`${path}:arg:${String(index)}`}>
                <ConditionAstNode
                  expr={arg}
                  path={`${path}:arg:${String(index)}`}
                  depth={depth + 1}
                />
              </li>
            ))}
          </ul>
        </BranchNode>
      );
    case "paren":
      return (
        <BranchNode title="paren" defaultOpen={depth < 1}>
          <div className="mt-1 pl-3">
            <ConditionAstNode expr={expr.expr} path={`${path}:inner`} depth={depth + 1} />
          </div>
        </BranchNode>
      );
    case "unary":
      return (
        <BranchNode title={`unary: ${expr.op}`} defaultOpen={depth < 1}>
          <div className="mt-1 pl-3">
            <ConditionAstNode expr={expr.expr} path={`${path}:expr`} depth={depth + 1} />
          </div>
        </BranchNode>
      );
    case "binary":
      return (
        <BranchNode title={`binary: ${expr.op}`} defaultOpen={depth < 1}>
          <ul className="m-0 mt-1 list-none space-y-1 p-0 pl-3">
            <li>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                left
              </span>
              <ConditionAstNode expr={expr.left} path={`${path}:left`} depth={depth + 1} />
            </li>
            <li>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                right
              </span>
              <ConditionAstNode expr={expr.right} path={`${path}:right`} depth={depth + 1} />
            </li>
          </ul>
        </BranchNode>
      );
    default:
      return <LeafNode label={`node: ${prettyCond(expr)}`} />;
  }
}

function BranchNode({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded border border-gray-200 bg-white px-1.5 py-1">
      <summary className="cursor-pointer select-none text-[10px] font-semibold text-gray-700">
        {title}
      </summary>
      {children}
    </details>
  );
}

function LeafNode({ label }: { label: string }) {
  return <span className="block rounded border border-gray-200 bg-white px-1.5 py-1 text-[10px] font-mono text-gray-700">{label}</span>;
}
