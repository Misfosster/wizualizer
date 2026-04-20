import { useState } from "react";
import { CollapsiblePanelShell } from "./collapsible-panel-shell";
import { GraphExplorerSection } from "./graph-explorer-section";

interface GraphExplorerPanelProps {
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function GraphExplorerPanel({
  isCollapsed: controlledCollapsed,
  onToggleCollapsed,
}: GraphExplorerPanelProps = {}) {
  const [localCollapsed, setLocalCollapsed] = useState<boolean>(false);
  const isCollapsed = controlledCollapsed ?? localCollapsed;

  return (
    <CollapsiblePanelShell
      dataPanelAttr="data-graph-explorer-panel"
      dataCollapsedAttr="data-graph-explorer-collapsed"
      toggleDataAttr="data-graph-explorer-toggle"
      ariaLabel="Graph explorer"
      title="Graph explorer"
      isCollapsed={isCollapsed}
      expandedClassName="max-h-[42vh] overflow-y-auto"
      onToggle={() => {
        if (onToggleCollapsed) {
          onToggleCollapsed();
          return;
        }
        setLocalCollapsed((prev) => !prev);
      }}
    >
      <GraphExplorerSection />
    </CollapsiblePanelShell>
  );
}
