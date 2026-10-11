"use client";

import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import { STAGES, STAGE_META } from "@/lib/constants";
import type { Stage } from "@/lib/types";
import { cn, Sheet } from "./ui";

/** Stage path. Phone: segmented progress bar + "Move stage" sheet. Desktop: Salesforce-style chevrons.
 *  Picking a stage opens a sheet that asks only for that stage's required fields. */
export function StagePath({ stage, onPick, disabled }: { stage: Stage; onPick: (s: Stage) => void; disabled?: boolean }) {
  const [picker, setPicker] = useState(false);
  const idx = STAGES.indexOf(stage);
  const path = STAGES.filter((s) => s !== "lost");
  const nextStage = stage === "lost" || stage === "won" ? null : STAGES[idx + 1];
  const m = STAGE_META[stage];

  return (
    <div>
      {/* Phone */}
      <div className="md:hidden">
        <div className="flex gap-1">
          {path.map((s, i) => (
            <span
              key={s}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: stage === "lost" ? "#fecaca" : i <= idx ? m.color : "#e5e7eb" }}
            />
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-muted">{stage === "lost" ? "Closed" : `Stage ${idx + 1} of 6`}</p>
            <p className="text-[15px] font-semibold" style={{ color: m.color }}>{m.label}</p>
            {nextStage && <p className="text-[12px] text-muted">Next: {STAGE_META[nextStage].label}</p>}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPicker(true)}
            className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-4 text-[13px] font-semibold text-brand active:bg-bg disabled:opacity-50"
          >
            Move stage <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {path.map((s, i) => {
            const done = stage !== "lost" && i < idx;
            const current = s === stage;
            return (
              <button
                key={s}
                type="button"
                disabled={disabled || current}
                onClick={() => onPick(s)}
                className={cn(
                  "flex h-8 min-w-fit flex-1 items-center justify-center gap-1 whitespace-nowrap px-4 text-[12px] font-medium transition-colors first:rounded-l-lg last:rounded-r-lg",
                  "[clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%,8px_50%)] first:[clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%)] last:[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,8px_50%)]",
                  current ? "text-white" : done ? "bg-brand-50 text-brand" : "bg-black/5 text-muted hover:bg-black/10",
                )}
                style={current ? { background: STAGE_META[s].color } : undefined}
              >
                {done && <Check className="size-3" />}
                {STAGE_META[s].label}
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
          {nextStage && <> · next: <button className="font-medium text-brand" onClick={() => onPick(nextStage)} disabled={disabled}>{STAGE_META[nextStage].label}</button> ({STAGE_META[nextStage].next})</>}
        </p>
      </div>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Move stage">
        <div className="-mx-1 space-y-1 pb-2">
          {STAGES.map((s, i) => {
            const sm = STAGE_META[s];
            const current = s === stage;
            const done = stage !== "lost" && i < idx && s !== "lost";
            return (
              <button
                key={s}
                type="button"
                disabled={current}
                onClick={() => { setPicker(false); onPick(s); }}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-bg", current && "bg-bg")}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: done || current ? sm.color : "#d1d5db" }}>
                  {done ? <Check className="size-4" /> : s === "lost" ? "×" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{sm.label}{current && <span className="ml-2 text-[12px] font-normal text-muted">current</span>}</span>
                  <span className="block text-[12px] text-muted">Needs: {sm.next}</span>
                </span>
                {!current && <ChevronRight className="size-4 text-muted" />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
