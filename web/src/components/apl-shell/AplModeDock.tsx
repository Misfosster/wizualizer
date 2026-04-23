import { TabsList, TabsTrigger } from "@components/ui/tabs";

export function AplModeDock() {
  return (
    <div className="-mt-px flex">
      <TabsList className="relative z-10 flex h-auto gap-1 rounded-b-lg rounded-t-none border border-t-0 border-gray-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-gray-900">
        <TabsTrigger
          value="write"
          className="rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900 data-[state=active]:hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:hover:bg-white/10"
        >
          Write
        </TabsTrigger>
        <TabsTrigger
          value="preview"
          className="rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900 data-[state=active]:hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:hover:bg-white/10"
        >
          Preview
        </TabsTrigger>
      </TabsList>
    </div>
  );
}
