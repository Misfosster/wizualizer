import { useState } from "react";
import manifest from "@/data/simc-defaults/manifest.json" with { type: "json" };
import { fetchSimcDefaultProfile } from "@/utils/simc-defaults/fetch-default-apl";
import { buildAplNameFromSelection } from "@/utils/simc-defaults/slug-utils";
import {
  SimcDefaultFetchError,
  type SimcDefaultClass,
} from "@/utils/simc-defaults/types";
import { NewAplMenuBreadcrumb } from "./NewAplMenuBreadcrumb";
import { NewAplMenuClassGrid } from "./NewAplMenuClassGrid";
import {
  flattenClassVariants,
  NewAplMenuSpecList,
  type SpecVariantRow,
} from "./NewAplMenuSpecList";

type NewAplMenuStep = "root" | "class" | "spec";

interface NewAplMenuProps {
  onCreateEmpty: () => void;
  onCreateFromDefault: (name: string, text: string) => void;
}

export function NewAplMenu({
  onCreateEmpty,
  onCreateFromDefault,
}: NewAplMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<NewAplMenuStep>("root");
  const [selectedClass, setSelectedClass] = useState<SimcDefaultClass | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryRow, setRetryRow] = useState<SpecVariantRow | null>(null);

  function resetFlow(): void {
    setStep("root");
    setSelectedClass(null);
    setIsLoading(false);
    setLoadError(null);
    setRetryRow(null);
  }

  function closeMenu(): void {
    setIsOpen(false);
    resetFlow();
  }

  async function loadProfile(row: SpecVariantRow): Promise<void> {
    setIsLoading(true);
    setLoadError(null);
    setRetryRow(row);

    try {
      const { text } = await fetchSimcDefaultProfile(row.variant.file);
      const name = buildAplNameFromSelection(
        row.classEntry.label,
        row.variant.label,
      );
      onCreateFromDefault(name, text);
      closeMenu();
    } catch (error) {
      const message =
        error instanceof SimcDefaultFetchError
          ? error.message
          : "Couldn't load the default profile. Try again?";
      setLoadError(message);
      setIsLoading(false);
    }
  }

  function handleRetry(): void {
    if (retryRow) {
      void loadProfile(retryRow);
    }
  }

  const panelClassName =
    "mt-2 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-gray-950";

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="new-apl-option"
        aria-expanded={isOpen}
        aria-controls="new-apl-menu-panel"
        onClick={() => {
          setIsOpen((open) => {
            if (open) {
              resetFlow();
            }
            return !open;
          });
        }}
        className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/15 dark:text-gray-200 dark:hover:border-blue-400/30 dark:hover:bg-blue-400/10 dark:hover:text-blue-100"
      >
        + New APL
      </button>
      {isOpen ? (
        <div
          id="new-apl-menu-panel"
          data-testid="new-apl-menu-panel"
          className={panelClassName}
        >
          {isLoading ? (
            <p
              role="status"
              className="px-2 py-3 text-sm font-medium normal-case tracking-normal text-gray-600 dark:text-gray-300"
            >
              Loading from SimulationCraft…
            </p>
          ) : loadError ? (
            <div className="space-y-2 px-1 py-1">
              <p className="text-sm font-medium normal-case tracking-normal text-red-700 dark:text-red-200">
                {loadError}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="min-h-11 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoadError(null);
                    setRetryRow(null);
                  }}
                  className="min-h-11 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-gray-950 dark:text-gray-200"
                >
                  Back
                </button>
              </div>
            </div>
          ) : step === "root" ? (
            <div className="space-y-1">
              <button
                type="button"
                data-testid="new-apl-empty"
                onClick={() => {
                  onCreateEmpty();
                  closeMenu();
                }}
                className="flex min-h-11 w-full items-center rounded-md px-2 py-2 text-left text-sm font-semibold normal-case tracking-normal text-gray-900 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-white dark:hover:bg-white/10"
              >
                Empty APL
              </button>
              <button
                type="button"
                data-testid="new-apl-simc-default"
                onClick={() => {
                  setStep("class");
                }}
                className="flex min-h-11 w-full items-center rounded-md px-2 py-2 text-left text-sm font-semibold normal-case tracking-normal text-blue-800 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-blue-100 dark:hover:bg-blue-400/10"
              >
                Load SimC default…
              </button>
            </div>
          ) : step === "class" ? (
            <>
              <NewAplMenuBreadcrumb
                items={[
                  {
                    label: "Selection",
                    onClick: () => {
                      setStep("root");
                    },
                  },
                ]}
              />
              <NewAplMenuClassGrid
                classes={manifest.classes}
                onSelectClass={(classEntry) => {
                  setSelectedClass(classEntry);
                  setStep("spec");
                }}
              />
            </>
          ) : selectedClass ? (
            <>
              <NewAplMenuBreadcrumb
                items={[
                  {
                    label: "Selection",
                    onClick: () => {
                      setStep("class");
                      setSelectedClass(null);
                    },
                  },
                  {
                    label: selectedClass.label,
                    classSlug: selectedClass.slug,
                  },
                ]}
              />
              <NewAplMenuSpecList
                rows={flattenClassVariants(selectedClass)}
                onSelectVariant={(row) => {
                  void loadProfile(row);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
