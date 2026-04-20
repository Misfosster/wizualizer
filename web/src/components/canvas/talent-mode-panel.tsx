import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";
import {
  readStoredTalentPanelCollapsed,
  writeStoredTalentPanelCollapsed,
} from "@/state/storage";
import { extractConditionAtoms } from "@/utils/conditions/extract-atoms";
import type { ConditionAtom } from "@/utils/conditions/types";
import { TalentModeSegmentedControl } from "./talent-mode-segmented-control";
import { TalentProfileStatusList } from "./talent-profile-status-list";
import { ConditionOverridesSection } from "./condition-overrides/ConditionOverridesSection";
import { CollapsiblePanelShell } from "./collapsible-panel-shell";

const EMPTY_PROFILE_ATOMS: ReadonlyMap<string, readonly ConditionAtom[]> =
  new Map();

interface TalentModePanelProps {
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

/**
 * Compact canvas panel that exposes the talent render mode and reports the
 * decode + filter status for each profile in the parsed document.
 *
 * Lives next to the React Flow viewport so the controls stay near the
 * graph they affect (Fitts's Law - keep CTAs close to their effect;
 * Nielsen #1 - visibility of system status, since the status rows
 * describe what the graph is currently filtering).
 *
 * Owns only the panel's own collapse state; render mode and decode data
 * come from the editor store, and the segmented control + per-profile
 * list are pure presentational components.
 */
export function TalentModePanel({
  isCollapsed: controlledCollapsed,
  onToggleCollapsed,
}: TalentModePanelProps = {}) {
  const {
    document,
    talentRenderMode,
    talentSelectionsByProfile,
    talentSummary,
    setTalentRenderMode,
  } = useEditorStore(
    useShallow((state) => ({
      document: state.document,
      talentRenderMode: state.talentRenderMode,
      talentSelectionsByProfile: state.talentSelectionsByProfile,
      talentSummary: state.talentSummary,
      setTalentRenderMode: state.setTalentRenderMode,
    })),
  );

  const profiles = document?.profiles ?? [];
  const profileAtomsByName = useMemo(
    () => (document ? extractConditionAtoms(document).byProfile : EMPTY_PROFILE_ATOMS),
    [document],
  );

  // Local state because no graph derivation depends on this; the store
  // would be over-wiring. Persisted to localStorage so the choice rides
  // across sessions like the render mode.
  const [localCollapsed, setLocalCollapsed] = useState<boolean>(() =>
    readStoredTalentPanelCollapsed(),
  );
  const isCollapsed = controlledCollapsed ?? localCollapsed;
  useEffect(() => {
    if (controlledCollapsed !== undefined) {
      return;
    }
    writeStoredTalentPanelCollapsed(localCollapsed);
  }, [controlledCollapsed, localCollapsed]);

  return (
    <CollapsiblePanelShell
      dataPanelAttr="data-talent-mode-panel"
      dataCollapsedAttr="data-talent-panel-collapsed"
      toggleDataAttr="data-talent-panel-toggle"
      ariaLabel="Condition filter"
      title="Condition filter"
      isCollapsed={isCollapsed}
      expandedClassName="h-auto max-h-full overflow-y-auto"
      onToggle={() => {
        if (onToggleCollapsed) {
          onToggleCollapsed();
          return;
        }
        setLocalCollapsed((prev) => !prev);
      }}
    >
      <div className="mt-2">
        <TalentModeSegmentedControl
          value={talentRenderMode}
          onChange={setTalentRenderMode}
        />
      </div>
      <TalentProfileStatusList
        profiles={profiles}
        selectionsByProfile={talentSelectionsByProfile}
        talentSummary={talentSummary}
        mode={talentRenderMode}
        profileAtomsByName={profileAtomsByName}
      />
      <ConditionOverridesSection />
    </CollapsiblePanelShell>
  );
}
