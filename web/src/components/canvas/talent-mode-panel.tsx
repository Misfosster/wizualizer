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
    hideTrueConditions,
    talentSelectionsByProfile,
    talentSummary,
    setTalentRenderMode,
    setHideTrueConditions,
  } = useEditorStore(
    useShallow((state) => ({
      document: state.document,
      talentRenderMode: state.talentRenderMode,
      hideTrueConditions: state.hideTrueConditions,
      talentSelectionsByProfile: state.talentSelectionsByProfile,
      talentSummary: state.talentSummary,
      setTalentRenderMode: state.setTalentRenderMode,
      setHideTrueConditions: state.setHideTrueConditions,
    })),
  );

  const profiles = document?.profiles ?? [];
  const profileAtomsByScopeKey = useMemo(
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
      expandedClassName=""
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
      <label
        className="nodrag nopan mt-2 flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <span>Dim proven-true conditions</span>
        <input
          type="checkbox"
          aria-label="Dim proven-true conditions"
          data-hide-true-conditions-toggle
          checked={hideTrueConditions}
          className="h-4 w-4 rounded border-gray-300 text-gray-800 focus:ring-2 focus:ring-blue-500"
          onChange={(event) => {
            setHideTrueConditions(event.currentTarget.checked);
          }}
        />
      </label>
      <TalentProfileStatusList
        profiles={profiles}
        selectionsByProfile={talentSelectionsByProfile}
        talentSummary={talentSummary}
        mode={talentRenderMode}
        profileAtomsByScopeKey={profileAtomsByScopeKey}
      />
      <ConditionOverridesSection />
    </CollapsiblePanelShell>
  );
}
