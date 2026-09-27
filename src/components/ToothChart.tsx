import { cn } from "@/lib/utils";
import { UPPER_TEETH, LOWER_TEETH, TOOTH_PATH, TOOTH_VIEWBOX } from "@/lib/toothChart";

interface ToothChartProps {
  selected: number[];
  onToggle: (tooth: number) => void;
  className?: string;
}

function Tooth({ tooth, isSelected, onClick }: { tooth: number; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Dhëmbi ${tooth}`}
      className="flex flex-col items-center gap-1 shrink-0 group"
    >
      <svg
        viewBox={`0 0 ${TOOTH_VIEWBOX.width} ${TOOTH_VIEWBOX.height}`}
        className="w-6 h-8 sm:w-7 sm:h-9 transition-transform group-active:scale-90"
      >
        <path
          d={TOOTH_PATH}
          strokeWidth={2.5}
          className={cn(
            "transition-colors",
            isSelected
              ? "fill-[hsl(38,62%,52%)] stroke-[hsl(32,55%,38%)]"
              : "fill-background stroke-border group-hover:fill-[hsl(38,62%,52%)]/20 group-hover:stroke-[hsl(38,62%,52%)]/60"
          )}
        />
      </svg>
      <span
        className={cn(
          "text-[10px] font-semibold leading-none",
          isSelected ? "text-[hsl(32,60%,40%)]" : "text-muted-foreground group-hover:text-foreground"
        )}
      >
        {tooth}
      </span>
    </button>
  );
}

/** Renders a clickable FDI tooth chart (upper + lower arch) so a specific tooth can be highlighted. */
export default function ToothChart({ selected, onToggle, className }: ToothChartProps) {
  const renderRow = (teeth: number[]) => (
    <div className="flex justify-center gap-1.5">
      {teeth.map((tooth, idx) => (
        <div key={tooth} className={cn(idx === 8 && "ml-3")}>
          <Tooth tooth={tooth} isSelected={selected.includes(tooth)} onClick={() => onToggle(tooth)} />
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn("space-y-3 p-4 rounded-lg border border-border bg-muted/20", className)}>
      {renderRow(UPPER_TEETH)}
      <div className="border-t border-dashed border-border" />
      {renderRow(LOWER_TEETH)}
    </div>
  );
}
