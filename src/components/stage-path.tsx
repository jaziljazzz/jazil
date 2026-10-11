"use client";

import { Check } from "lucide-react";
import { STAGES, STAGE_META } from "@/lib/constants";
import type { Stage } from "@/lib/types";
import { cn } from "./ui";

/** Salesforce-style path: chevrons for the 7 stages, current filled. Tap a stage to open its required fields. */
export function StagePath({ stage, onPick, disabled }: { stage: Stage; onPick: (s: Stage) => void; disabled?: boolean }) {
  const idx = STAGES.indexOf(stage);
  const path = STAGES.filter((s) => s !== "lost");
  const nextStage = stage === "lost" || stage === "won" ? null : STAGES[idx + 1];
  return (
    <div>
      <div className="no-scrollbar flex gap-1 overflow-x-auto">
        {path.map((s, i) => {
          const done = stage !== "lost" && i < idx;
          const current = s === stage;
          const m = STAGE_META[s];
          return (
            <button
              key={s}
              type="button"
              disabled={disabled || current}
              onClick={() => onPick(s)}
              className={cn(
                "relative flex h-8 min-w-0 flex-1 shrink-0 items-center justify-center gap-1 px-3 text-[12px] font-medium transition-colors first:rounded-l-lg last:rounded-r-lg",
                "[clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%,8px_50%)] first:[clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%)] last:[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,8px_50%)]",
                current ? "text-white" : done ? "bg-brand-50 text-brand" : "bg-black/5 text-muted hover:bg-black/10",
              )}
              style={current ? { background: m.color } : undefined}
              title={m.label}
            >
              {done && <Check className="size-3" />}
              <span className="truncate">{m.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled || stage === "lost"}
          onClick={() => onPick("lost")}
          className={cn("ml-1 h-8 shrink-0 rounded-lg px-3 text-[12px] font-medium", stage === "lost" ? "bg-danger text-white" : "bg-danger-50 text-danger hover:bg-danger/15")}
        >
          Lost
        </button>
      </div>
      <p className="mt-1.5 text-[12px] text-muted">
        Stage {stage === "lost" ? "—" : idx + 1} of 7
        {nextStage && <> · next: <button className="font-medium text-brand" onClick={() => onPick(nextStage)} disabled={disabled}>{STAGE_META[nextStage].label}</button> <span className="hidden sm:inline">({STAGE_META[nextStage].next})</span></>}
      </p>
    </div>
  );
}
