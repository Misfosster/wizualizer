import "@styles/tailwind.css";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent } from "@components/ui/tabs";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";
import { AplCodeEditor } from "@components/apl-editor/AplCodeEditor";
import type { AplEditorLineJumpRequest } from "@components/apl-editor/types";
import { AplModeDock } from "@components/apl-shell/AplModeDock";
import { AplToolbar } from "@components/apl-shell/AplToolbar";
import { EditorSaveIndicator } from "@components/apl-shell/EditorSaveIndicator";
import Canvas from "@components/canvas";
import { useEditorStore } from "@/state/editorStore";
import { semanticCatalogLoader } from "@/utils/semantics/catalog-loader-browser";

const ACTIVE_TAB_STORAGE_KEY = "logiccraft.activeAplTab";
type AplInputTab = "write" | "preview";

function isAplInputTab(value: string | null): value is AplInputTab {
  return value === "write" || value === "preview";
}

function readStoredActiveTab(): AplInputTab {
  if (typeof window === "undefined") {
    return "write";
  }

  const storedTab = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
  return isAplInputTab(storedTab) ? storedTab : "write";
}

function AplInput() {
  const [activeTab, setActiveTab] = useState<AplInputTab>(readStoredActiveTab);
  const [lineJumpRequest, setLineJumpRequest] =
    useState<AplEditorLineJumpRequest | null>(null);
  const {
    savedApls,
    activeAplId,
    autoSaveEnabled,
    hasUnsavedChanges,
    aplText,
    parseError,
    parseErrorLineNumber,
    diagnostics,
    document,
    applyAplText,
    saveActiveApl,
    setAutoSaveEnabled,
    switchApl,
    createApl,
    duplicateApl,
    renameApl,
    deleteApl,
  } = useEditorStore(
    useShallow((state) => ({
      savedApls: state.savedApls,
      activeAplId: state.activeAplId,
      autoSaveEnabled: state.autoSaveEnabled,
      hasUnsavedChanges: state.hasUnsavedChanges,
      aplText: state.aplText,
      parseError: state.parseError,
      parseErrorLineNumber: state.parseErrorLineNumber,
      diagnostics: state.diagnostics,
      document: state.document,
      applyAplText: state.applyAplText,
      saveActiveApl: state.saveActiveApl,
      setAutoSaveEnabled: state.setAutoSaveEnabled,
      switchApl: state.switchApl,
      createApl: state.createApl,
      duplicateApl: state.duplicateApl,
      renameApl: state.renameApl,
      deleteApl: state.deleteApl,
    })),
  );
  const warningDiagnostics = parseError
    ? []
    : diagnostics
        .filter((diagnostic) => diagnostic.severity === "warning")
        .slice(0, 4);
  const completionContext = useMemo(
    () => ({
      document,
      lookupSemanticSpec: (classSlug: string, specSlug: string) =>
        semanticCatalogLoader.lookupSpec(classSlug, specSlug),
    }),
    [document],
  );

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveActiveApl();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [saveActiveApl]);

  function handleGoToParseErrorLine(): void {
    if (!parseErrorLineNumber) {
      return;
    }

    setActiveTab("write");
    setLineJumpRequest((request) => ({
      lineNumber: parseErrorLineNumber,
      requestId: (request?.requestId ?? 0) + 1,
    }));
  }

  const isPreviewActive = activeTab === "preview";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (isAplInputTab(value)) {
          setActiveTab(value);
        }
      }}
    >
      <div>
        <AplToolbar
          savedApls={savedApls}
          activeAplId={activeAplId}
          autoSaveEnabled={autoSaveEnabled}
          hasUnsavedChanges={hasUnsavedChanges}
          onSave={saveActiveApl}
          onAutoSaveChange={setAutoSaveEnabled}
          onSwitchApl={switchApl}
          onCreateApl={createApl}
          onDuplicateApl={duplicateApl}
          onRenameApl={renameApl}
          onDeleteApl={deleteApl}
        />
        <AplModeDock />
      </div>
      <div className="relative mt-2">
        <TabsContent value="write" forceMount className="m-0 rounded-lg">
          <div className="relative">
            <AplCodeEditor
              value={aplText}
              parseErrorLineNumber={parseErrorLineNumber}
              lineJumpRequest={lineJumpRequest}
              completionContext={completionContext}
              onChange={applyAplText}
            />
            <EditorSaveIndicator
              autoSaveEnabled={autoSaveEnabled}
              hasUnsavedChanges={hasUnsavedChanges}
              onSave={saveActiveApl}
            />
          </div>
          {parseError ? (
            <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <div>
                <p>{parseError}</p>
                <p className="mt-1 text-amber-800/80 dark:text-amber-100/80">
                  Preview shows the last successful parse when available.
                </p>
              </div>
              {parseErrorLineNumber ? (
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-amber-300/70 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-200 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100 dark:hover:bg-amber-300/20"
                  onClick={handleGoToParseErrorLine}
                >
                  Go to line {parseErrorLineNumber}
                </button>
              ) : null}
            </div>
          ) : null}
          {!parseError && warningDiagnostics.length > 0 ? (
            <div
              data-apl-diagnostics="warnings"
              className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-100"
            >
              <p className="font-semibold">APL suggestions</p>
              <ul className="mt-1 list-none space-y-1 p-0">
                {warningDiagnostics.map((diagnostic) => (
                  <li
                    key={`${String(diagnostic.lineNumber)}:${diagnostic.code}:${diagnostic.message}`}
                    data-apl-diagnostic-line={diagnostic.lineNumber}
                  >
                    Line {diagnostic.lineNumber}: {diagnostic.message}
                    {diagnostic.suggestion ? (
                      <span> {diagnostic.suggestion}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </TabsContent>
        <div
          role="tabpanel"
          aria-label="Preview"
          aria-hidden={!isPreviewActive}
          className={cn(
            "m-0 rounded-lg",
            isPreviewActive
              ? "relative"
              : "pointer-events-none absolute inset-x-0 top-0 overflow-hidden opacity-0",
          )}
          style={
            isPreviewActive
              ? undefined
              : { transform: "translateX(-200vw)" }
          }
        >
          <div className="h-[72vh] w-full overflow-hidden rounded-md border border-gray-200 dark:border-white/10">
            <Canvas />
          </div>
        </div>
      </div>
    </Tabs>
  );
}

export default AplInput;
