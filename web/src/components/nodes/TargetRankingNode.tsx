import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { CONDITION_HANDLE_IDS, type TargetRankingFlowNode } from "./types";
import { NodeCard, TargetHandle } from "./shared";

function TargetRankingNode({
  data,
  isConnectable,
}: NodeProps<TargetRankingFlowNode>) {
  return (
    <NodeCard
      className="lc-node-card--targetRanking"
      talentState={data.talentState}
      talentReason={data.talentReason}
    >
      <TargetHandle
        isConnectable={isConnectable}
        id={CONDITION_HANDLE_IDS.targetLeft}
      />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Target If</div>
          <div className="lc-node-title lc-node-title--mono">{data.label}</div>
        </div>
      </div>
    </NodeCard>
  );
}

export default memo(TargetRankingNode);
