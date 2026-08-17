import { getWowClassVisual } from "@/data/wow-class-visuals";

export interface NewAplMenuBreadcrumbItem {
  label: string;
  onClick?: () => void;
  classSlug?: string;
}

interface NewAplMenuBreadcrumbProps {
  items: readonly NewAplMenuBreadcrumbItem[];
}

function BreadcrumbBackArrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 5 7 10l5 5" />
    </svg>
  );
}

export function NewAplMenuBreadcrumb({ items }: NewAplMenuBreadcrumbProps) {
  return (
    <nav
      aria-label="New APL navigation"
      className="mb-2 flex min-h-11 flex-wrap items-center gap-1 px-1 text-xs font-semibold normal-case tracking-normal"
    >
      {items.map((item, index) => {
        const classVisual = item.classSlug
          ? getWowClassVisual(item.classSlug)
          : null;
        const color = classVisual?.color;

        return (
          <span key={`${item.label}:${String(index)}`} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="text-gray-400 dark:text-gray-500"
              >
                →
              </span>
            ) : null}
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="inline-flex min-h-11 items-center gap-1 rounded px-1 py-0.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <BreadcrumbBackArrow />
                <span>{item.label}</span>
              </button>
            ) : (
              <span
                className="px-1 py-0.5"
                style={color ? { color } : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
