import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { TalentState } from "./types";

interface NodeCardProps {
  className?: string;
  children: ReactNode;
  /**
   * Talent-filter verdict for this node. When `"impossible"`, the card
   * renders in a subdued, low-contrast treatment (applied via
   * `.lc-node-card--impossible` in CSS) so the user can scan which actions
   * the active filter considers unreachable without losing graph context.
   * Only meaningful in Dim mode for actions; in Hide mode the node isn't
   * rendered for filtered actions; in Off mode the value is undefined.
   */
  talentState?: TalentState;
  talentReason?: string;
  /** De-emphasize condition leaves that already resolve true (condition filter). */
  resolvedAsTrue?: boolean;
  /** Subgraph provably false under decode while action may still remain (talent Dim). */
  decodeProvedFalse?: boolean;
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

export function NodeCard({
  className,
  children,
  talentState,
  talentReason,
  resolvedAsTrue,
  decodeProvedFalse,
}: NodeCardProps) {
  const impossibleClass =
    talentState === "impossible" ? "lc-node-card--impossible" : undefined;
  const decodeFalseClass =
    talentState !== "impossible" && decodeProvedFalse
      ? "lc-node-card--decodeProvedFalse"
      : undefined;
  const resolvedTrueClass =
    talentState !== "impossible" &&
    !decodeProvedFalse &&
    resolvedAsTrue
      ? "lc-node-card--resolvedTrue"
      : undefined;
  const reasonLabel =
    talentState === "impossible" ? (talentReason ?? "filtered") : undefined;
  return (
    <div
      data-talent-state={talentState ?? "normal"}
      data-talent-reason={reasonLabel}
      data-resolved-condition={resolvedAsTrue ? "true" : undefined}
      data-decode-proved-false={decodeProvedFalse ? "true" : undefined}
      className={cn(
        "lc-node-card",
        className,
        impossibleClass,
        decodeFalseClass,
        resolvedTrueClass,
      )}
    >
      {children}
    </div>
  );
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
