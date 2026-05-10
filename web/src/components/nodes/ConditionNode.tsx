import { memo } from "react";
import { Check, X } from "lucide-react";
import { Position, type NodeProps } from "@xyflow/react";
import { CONDITION_HANDLE_IDS, type ConditionFlowNode } from "./types";
import { NodeCard, SourceHandle, TargetHandle } from "./shared";
import { cn } from "@/lib/utils";

function ConditionNode({
  data,
  isConnectable,
}: NodeProps<ConditionFlowNode>) {
  const handleUsage = data.handleUsage ?? {};
  const isTargetIf = data.segmentKind === "target_if";
  const provedFalseBadge =
    data.talentState !== "impossible" &&
    (data.decodeProvedFalse === true || data.resolvedAsFalse === true);
  const showResolvedTrue =
    data.resolvedAsTrue === true &&
    data.talentState !== "impossible" &&
    !provedFalseBadge;

  return (
    <NodeCard
      className={cn(
        "lc-node-card--condition",
        isTargetIf && "lc-node-card--targetCondition",
      )}
      talentState={data.talentState}
      talentReason={data.talentReason}
      resolvedAsTrue={data.resolvedAsTrue}
      decodeProvedFalse={data.decodeProvedFalse}
      resolvedAsFalse={data.resolvedAsFalse}
    >
      {handleUsage.targetLeft ? (
        <TargetHandle
          isConnectable={isConnectable}
          id={CONDITION_HANDLE_IDS.targetLeft}
        />
      ) : null}
      {handleUsage.sourceRight ? (
        <SourceHandle
          isConnectable={isConnectable}
          id={CONDITION_HANDLE_IDS.sourceRight}
        />
      ) : null}
      {handleUsage.targetTop ? (
        <TargetHandle
          isConnectable={isConnectable}
          id={CONDITION_HANDLE_IDS.targetTop}
          position={Position.Top}
        />
      ) : null}
      {handleUsage.sourceBottom ? (
        <SourceHandle
          isConnectable={isConnectable}
          id={CONDITION_HANDLE_IDS.sourceBottom}
          position={Position.Bottom}
        />
      ) : null}

      {showResolvedTrue ? (
        <span
          className={cn(
            "lc-condition-resolved-true-badge",
            isTargetIf && "lc-condition-resolved-true-badge--targetIf",
          )}
          aria-label="This condition resolves true with the current talent decode and overrides"
          data-condition-resolves-true-badge
        >
          <Check className="lc-condition-resolved-true-badge__icon" aria-hidden />
        </span>
      ) : null}
      {provedFalseBadge ? (
        <span
          className={cn(
            "lc-condition-proved-false-badge",
            isTargetIf && "lc-condition-proved-false-badge--targetIf",
          )}
          aria-label="This condition resolves false with the current talent decode and overrides"
          data-condition-proved-false-badge
        >
          <X className="lc-condition-proved-false-badge__icon" aria-hidden />
        </span>
      ) : null}

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">
            {isTargetIf ? "Target If" : "Condition"}
          </div>
          <div className="lc-node-title lc-node-title--mono">{data.label}</div>
        </div>
      </div>
    </NodeCard>
  );
}

export default memo(ConditionNode);
