"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActions } from "@/components/actions";
import { budgetLabel, DueText, SourceIcon } from "@/components/lead-card";
import { cn, Select } from "@/components/ui";
import { STAGES, STAGE_META } from "@/lib/constants";
import { rot } from "@/lib/format";
import type { Lead, Profile, Stage } from "@/lib/types";

export function Board({ leads, team, agent, staleDays }: { leads: Lead[]; team: Profile[]; agent: string; staleDays: number }) {
  const router = useRouter();
  const { changeStage, isFounder } = useActions();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [active, setActive] = useState<Stage>("new");
  const scroller = useRef<HTMLDivElement>(null);
  const owners = Object.fromEntries(team.map((t) => [t.id, t.name.split(" ")[0]]));
  const by = Object.fromEntries(STAGES.map((s) => [s, leads.filter((l) => l.stage === s)])) as Record<Stage, Lead[]>;

  // Phone: keep the stage tab in sync with horizontal swipe
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      if (window.innerWidth >= 768) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (STAGES[i]) setActive(STAGES[i]!);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const jump = (s: Stage) => {
    setActive(s);
    const el = scroller.current;
    if (el && window.innerWidth < 768) el.scrollTo({ left: STAGES.indexOf(s) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col md:h-dvh">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 empty:hidden md:px-6 md:pt-6">
        <h1 className="hidden text-[20px] font-semibold md:block">Pipeline</h1>
        {isFounder && (
          <Select className="w-full md:w-44" value={agent} onChange={(e) => router.replace(e.target.value ? `/pipeline?agent=${e.target.value}` : "/pipeline")}>
            <option value="">All agents</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        )}
      </div>

      {/* Phone stage tabs with counts */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-3 md:hidden">
        {STAGES.map((s) => (
          <button key={s} onClick={() => jump(s)}
            className={cn("h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-[12px] font-medium", active === s ? "text-white" : "bg-surface text-muted border border-line")}
            style={active === s ? { background: STAGE_META[s].color } : undefined}>
            {STAGE_META[s].label} <span className="tabular opacity-80">{by[s].length}</span>
          </button>
        ))}
      </div>

      <div ref={scroller} className="no-scrollbar flex flex-1 snap-x snap-mandatory gap-0 overflow-x-auto md:snap-none md:gap-3 md:px-6 md:py-4">
        {STAGES.map((s) => {
          const m = STAGE_META[s];
          return (
            <div key={s}
              className={cn("flex w-full shrink-0 snap-start flex-col px-4 md:w-72 md:rounded-xl md:border md:border-line md:bg-bg md:px-0", over === s && "md:border-brand md:bg-brand-50/50")}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }}
              onDragLeave={() => setOver((o) => (o === s ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const lead = leads.find((l) => l.id === dragId);
                setDragId(null);
                if (lead && lead.stage !== s) changeStage(lead, s);
              }}>
              <div className="hidden items-center justify-between px-3 py-2.5 md:flex">
                <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="size-2 rounded-full" style={{ background: m.color }} />{m.label}</span>
                <span className="tabular text-[12px] text-muted">{by[s].length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto pb-24 md:px-2 md:pb-2">
                {by[s].length === 0 && <p className="py-8 text-center text-[12px] text-muted">Empty</p>}
                {by[s].map((l) => {
                  const r = l.stage === "won" || l.stage === "lost" ? "fresh" : rot(l.last_activity_at, staleDays);
                  return (
                    <Link key={l.id} href={`/leads/${l.id}`} draggable
                      onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)}
                      className={cn(
                        "block rounded-[10px] border bg-surface p-3 transition-shadow hover:shadow-sm",
                        r === "red" ? "border-danger/50 border-l-4 border-l-danger" : r === "amber" ? "border-warning/50 border-l-4 border-l-warning" : "border-line",
                        dragId === l.id && "opacity-50",
                      )}>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold">{l.name}</span>
                        <SourceIcon source={l.source} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px]">
                        <DueText lead={l} />
                        {budgetLabel(l.requirements) && <span className="text-muted">{budgetLabel(l.requirements)}</span>}
                      </div>
                      {(isFounder && owners[l.owner_id ?? ""]) || l.lost_reason || l.selected_project ? (
                        <div className="mt-1 truncate text-[11px] text-muted">
                          {[isFounder && owners[l.owner_id ?? ""], l.selected_project, l.lost_reason].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
