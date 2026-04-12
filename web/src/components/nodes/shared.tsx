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
  position?: Position;
}

interface MetaPillProps {
  className?: string;
  children: ReactNode;
}

export function NodeCard({ className, children }: NodeCardProps) {
  return <div className={cn("lc-node-card", className)}>{children}</div>;
}

const POSITION_CLASS: Record<Position, string> = {
  [Position.Left]: "lc-node-handle--left",
  [Position.Right]: "lc-node-handle--right",
  [Position.Top]: "lc-node-handle--top",
  [Position.Bottom]: "lc-node-handle--bottom",
};

export function TargetHandle({
  isConnectable,
  id,
  className,
  position = Position.Left,
}: HandleProps) {
  return (
    <Handle
      id={id}
      type="target"
      position={position}
      isConnectable={isConnectable}
      className={cn(
        "lc-node-handle",
        "lc-node-handle--target",
        POSITION_CLASS[position],
        className,
      )}
    />
  );
}

export function SourceHandle({
  isConnectable,
  id,
  className,
  position = Position.Right,
}: HandleProps) {
  return (
    <Handle
      id={id}
      type="source"
      position={position}
      isConnectable={isConnectable}
      className={cn(
        "lc-node-handle",
        "lc-node-handle--source",
        POSITION_CLASS[position],
        className,
      )}
    />
  );
}

export function MetaPill({ className, children }: MetaPillProps) {
  return <span className={cn("lc-node-meta", className)}>{children}</span>;
}
