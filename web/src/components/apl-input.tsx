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
import {
  APL_STORAGE_KEY,
  LAST_GOOD_APL_STORAGE_KEY,
  useEditorStore,
} from "@/state/editorStore";

const APL_STORAGE_DEBOUNCE_MS = 300; // the delay between the last keypress and the save to localStorage
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
    aplText,
    lastGoodText,
    parseError,
    parseErrorLineNumber,
    applyAplText,
  } = useEditorStore(
    useShallow((state) => ({
      aplText: state.aplText,
      lastGoodText: state.lastGoodText,
      parseError: state.parseError,
      parseErrorLineNumber: state.parseErrorLineNumber,
      applyAplText: state.applyAplText,
    })),
  );

  useEffect(() => {
    // debounce writes so we don't save to localStorage on every keypress
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(APL_STORAGE_KEY, aplText);
    }, APL_STORAGE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [aplText]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(LAST_GOOD_APL_STORAGE_KEY, lastGoodText);
    }, APL_STORAGE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastGoodText]);

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
