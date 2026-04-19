import { useEffect, useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";
import {
  readStoredTalentPanelCollapsed,
  writeStoredTalentPanelCollapsed,
} from "@/state/storage";
import { TalentModeSegmentedControl } from "./talent-mode-segmented-control";
import { TalentProfileStatusList } from "./talent-profile-status-list";
import { ConditionOverridesSection } from "./condition-overrides/ConditionOverridesSection";

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
export function TalentModePanel() {
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

  // Local state because no graph derivation depends on this; the store
  // would be over-wiring. Persisted to localStorage so the choice rides
  // across sessions like the render mode.
  const [isCollapsed, setCollapsed] = useState<boolean>(() =>
    readStoredTalentPanelCollapsed(),
  );
  useEffect(() => {
    writeStoredTalentPanelCollapsed(isCollapsed);
  }, [isCollapsed]);

  const contentId = useId();
  const toggleLabel = isCollapsed
    ? "Expand condition filter"
    : "Collapse condition filter";

  return (
    <section
      data-talent-mode-panel=""
      data-talent-panel-collapsed={isCollapsed ? "true" : "false"}
      aria-label="Condition filter"
      className="nodrag nopan w-72 max-w-xs rounded-md border border-gray-300 bg-white/95 p-3 text-gray-700 shadow-sm"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Condition filter
        </h2>
        <button
          type="button"
          data-talent-panel-toggle=""
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={() => {
            setCollapsed((prev) => !prev);
          }}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          {isCollapsed ? (
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </header>
      {isCollapsed ? null : (
        <div id={contentId} className="mt-2">
          <TalentModeSegmentedControl
            value={talentRenderMode}
            onChange={setTalentRenderMode}
          />
          <TalentProfileStatusList
            profiles={profiles}
            selectionsByProfile={talentSelectionsByProfile}
            talentSummary={talentSummary}
            mode={talentRenderMode}
          />
          <ConditionOverridesSection />
        </div>
      )}
    </section>
  );
}
