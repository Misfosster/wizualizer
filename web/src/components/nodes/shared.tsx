import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface NodeCardProps {
  className?: string;
  children: ReactNode;
}

interface HandleProps {
  isConnectable: boolean;
  id?: string;
  className?: string;
}

interface MetaPillProps {
  className?: string;
  children: ReactNode;
}

export function NodeCard({ className, children }: NodeCardProps) {
  return <div className={cn("lc-node-card", className)}>{children}</div>;
}

export function TargetHandle({ isConnectable, id, className }: HandleProps) {
  return (
    <Handle
      id={id}
      type="target"
      position={Position.Left}
      isConnectable={isConnectable}
      className={cn("lc-node-handle", "lc-node-handle--target", className)}
    />
  );
}

export function SourceHandle({ isConnectable, id, className }: HandleProps) {
  return (
    <Handle
      id={id}
      type="source"
      position={Position.Right}
      isConnectable={isConnectable}
      className={cn("lc-node-handle", "lc-node-handle--source", className)}
    />
  );
}

export function MetaPill({ className, children }: MetaPillProps) {
  return <span className={cn("lc-node-meta", className)}>{children}</span>;
}
