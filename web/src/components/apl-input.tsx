import "@styles/tailwind.css";
import { useEffect } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@components/ui/tabs";
import Canvas from "@components/canvas";
import { APL_STORAGE_KEY, useEditorStore } from "@/state/editorStore";

const APL_STORAGE_DEBOUNCE_MS = 300; // the delay between the last keypress and the save to localStorage

function AplInput() {
  const aplText = useEditorStore((state) => state.aplText);
  const setAplText = useEditorStore((state) => state.setAplText);

  useEffect(() => {
    // debounce writes so we don't save to localStorage on every keypress
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(APL_STORAGE_KEY, aplText);
    }, APL_STORAGE_DEBOUNCE_MS);

    return () => {window.clearTimeout(timeoutId)}; 
  }, [aplText]);

  return (
    <Tabs defaultValue="write">
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
          <label htmlFor="comment" className="sr-only">
            Comment
          </label>
          <div>
            <textarea
              id="comment"
              name="comment"
              rows={5}
              placeholder="Paste APL..."
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
              value={aplText}
              onChange={(event) => {setAplText(event.target.value)}} //update zustand store (state)
            />
          </div>
        </TabsContent>
        <TabsContent value="preview" className="-m-0.5 rounded-lg p-0.5">
          <div className="border-b border-gray-200 dark:border-white/10">
            <div className="h-[60vh] w-full rounded-md border border-gray-200 overflow-hidden dark:border-white/10">
              <Canvas />
            </div>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}

export default AplInput;
