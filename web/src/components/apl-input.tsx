import "@styles/tailwind.css";
import { useEffect, useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@components/ui/tabs";
import { useShallow } from "zustand/react/shallow";
import { AplCodeEditor } from "@components/apl-editor/AplCodeEditor";
import type { AplEditorLineJumpRequest } from "@components/apl-editor/types";
import Canvas from "@components/canvas";
import { useEditorStore } from "@/state/editorStore";
import {
  writeStoredActiveAplSnapshot,
  writeStoredAplLibrary,
} from "@/state/storage";

const APL_STORAGE_DEBOUNCE_MS = 300; // the delay between the last edit and the save to localStorage
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

function getAplDisplayName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Untitled APL";
}

function AplInput() {
  const [activeTab, setActiveTab] = useState<AplInputTab>(readStoredActiveTab);
  const [lineJumpRequest, setLineJumpRequest] =
    useState<AplEditorLineJumpRequest | null>(null);
  const {
    savedApls,
    activeAplId,
    aplText,
    parseError,
    parseErrorLineNumber,
    applyAplText,
    switchApl,
    createApl,
    duplicateActiveApl,
    renameActiveApl,
    deleteActiveApl,
  } = useEditorStore(
    useShallow((state) => ({
      savedApls: state.savedApls,
      activeAplId: state.activeAplId,
      aplText: state.aplText,
      parseError: state.parseError,
      parseErrorLineNumber: state.parseErrorLineNumber,
      applyAplText: state.applyAplText,
      switchApl: state.switchApl,
      createApl: state.createApl,
      duplicateActiveApl: state.duplicateActiveApl,
      renameActiveApl: state.renameActiveApl,
      deleteActiveApl: state.deleteActiveApl,
    })),
  );
  const activeApl = savedApls.find((apl) => apl.id === activeAplId);
  const activeAplName = activeApl?.name ?? "";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      writeStoredAplLibrary({ apls: savedApls, activeAplId });
      const nextActiveApl = savedApls.find((apl) => apl.id === activeAplId);
      if (nextActiveApl) {
        writeStoredActiveAplSnapshot(nextActiveApl);
      }
    }, APL_STORAGE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeAplId, savedApls]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

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

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (isAplInputTab(value)) {
          setActiveTab(value);
        }
      }}
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-gray-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(12rem,18rem)_minmax(12rem,1fr)]">
              <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Saved APL
                <select
                  aria-label="Saved APL"
                  data-testid="apl-library-select"
                  value={activeAplId}
                  onChange={(event) => {
                    switchApl(event.target.value);
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium normal-case tracking-normal text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-gray-950 dark:text-white"
                >
                  {savedApls.map((apl) => (
                    <option key={apl.id} value={apl.id}>
                      {getAplDisplayName(apl.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                APL name
                <input
                  type="text"
                  aria-label="APL name"
                  data-testid="apl-name-input"
                  value={activeAplName}
                  maxLength={80}
                  onChange={(event) => {
                    renameActiveApl(event.target.value);
                  }}
                  placeholder="Untitled APL"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium normal-case tracking-normal text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-gray-950 dark:text-white"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createApl}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-white/10"
              >
                New APL
              </button>
              <button
                type="button"
                onClick={duplicateActiveApl}
                className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100 dark:hover:bg-blue-400/20"
              >
                Save Copy
              </button>
              <button
                type="button"
                onClick={deleteActiveApl}
                disabled={savedApls.length <= 1}
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/25 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white dark:border-red-400/20 dark:bg-gray-950 dark:text-red-200 dark:hover:bg-red-400/10 dark:disabled:border-white/10 dark:disabled:text-gray-600 dark:disabled:hover:bg-gray-950"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <TabsList className="flex gap-2">
            <TabsTrigger
              value="write"
              className="rounded-md border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900 data-[state=active]:hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:hover:bg-white/10"
            >
              Write
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="rounded-md border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900 data-[state=active]:hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:hover:bg-white/10"
            >
              Preview
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      <div className="mt-2">
        <TabsContent value="write" className="-m-0.5 rounded-lg p-0.5">
          <AplCodeEditor
            value={aplText}
            parseErrorLineNumber={parseErrorLineNumber}
            lineJumpRequest={lineJumpRequest}
            onChange={applyAplText}
          />
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
        </TabsContent>
        <TabsContent value="preview" className="-m-0.5 rounded-lg p-0.5">
          <div className="border-b border-gray-200 dark:border-white/10">
            <div className="h-[72vh] w-full rounded-md border border-gray-200 overflow-hidden dark:border-white/10">
              <Canvas />
            </div>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}

export default AplInput;
