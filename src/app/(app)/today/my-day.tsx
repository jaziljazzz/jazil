"use client";

import { CheckCircle2, Play, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LeadCard, LeadList } from "@/components/lead-card";
import { useActions } from "@/components/actions";
import { Button, Card, cn, EmptyState, StatCard } from "@/components/ui";
import type { Lead } from "@/lib/types";

type Filter = "all" | "overdue" | "today" | "untouched";

export function MyDay({ greeting, date, overdue, today, untouched, team }: {
  greeting: string; date: string; overdue: Lead[]; today: Lead[]; untouched: Lead[];
  team: { overdue: number; byAgent: { id: string; name: string; overdue: number }[] } | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { isFounder } = useActions();
  const total = overdue.length + today.length + untouched.length;
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));

  const sections: { key: Filter; title: string; leads: Lead[]; tone: string }[] = [
    { key: "overdue", title: "Overdue", leads: overdue, tone: "text-danger" },
    { key: "today", title: "Due today", leads: today, tone: "text-warning" },
    { key: "untouched", title: "New untouched", leads: untouched, tone: "text-info" },
  ];

  return (
    <div
      className="mx-auto max-w-3xl px-4 py-4 md:px-8 md:py-8"
      onTouchStart={(e) => ((e.currentTarget as HTMLElement).dataset.y = String(window.scrollY === 0 ? e.touches[0]!.clientY : -1))}
      onTouchEnd={(e) => {
        const y0 = Number((e.currentTarget as HTMLElement).dataset.y);
        if (y0 >= 0 && e.changedTouches[0]!.clientY - y0 > 90) {
          setRefreshing(true);
          router.refresh();
          setTimeout(() => setRefreshing(false), 800);
        }
      }}
    >
      {refreshing && <div className="mb-2 flex justify-center text-muted"><RefreshCw className="size-4 animate-spin" /></div>}
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold">{greeting}</h1>
        <p className="text-[13px] text-muted">{date}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Overdue" value={overdue.length} tone="danger" onClick={() => toggle("overdue")} active={filter === "overdue"} />
        <StatCard label="Due today" value={today.length} tone="warning" onClick={() => toggle("today")} active={filter === "today"} />
        <StatCard label="Untouched" value={untouched.length} tone="info" onClick={() => toggle("untouched")} active={filter === "untouched"} />
      </div>

      {isFounder && team && (
        <Card className="mt-3 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Team overdue</span>
            <span className={cn("tabular text-[18px] font-semibold", team.overdue ? "text-danger" : "text-success")}>{team.overdue}</span>
          </div>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {team.byAgent.map((a) => (
              <Link key={a.id} href={`/leads?view=overdue&agent=${a.id}`} className="shrink-0 rounded-full border border-line px-3 py-1 text-[12px]">
                {a.name.split(" ")[0]} <span className={cn("tabular font-semibold", a.overdue ? "text-danger" : "text-muted")}>{a.overdue}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {total > 0 && (
        <Link href="/queue" className="mt-4 block">
          <Button size="lg" className="w-full text-[15px]">
            <Play className="size-4 fill-current" /> Start calls ({total})
          </Button>
        </Link>
      )}

      <div className="mt-5 space-y-6">
        {total === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 className="size-6" />}
              title="All caught up"
              action={
                <div className="flex gap-2">
                  <Link href="/leads?view=new"><Button variant="secondary">New leads</Button></Link>
                  {isFounder && <Link href="/recycle"><Button variant="secondary">Recycle pool</Button></Link>}
                </div>
              }
            />
          </Card>
        ) : (
          sections.filter((s) => (filter === "all" || filter === s.key) && s.leads.length > 0).map((s) => (
            <section key={s.key}>
              <h2 className={cn("mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide", s.tone)}>{s.title} · {s.leads.length}</h2>
              <LeadList>
                {s.leads.map((l) => <LeadCard key={l.id} lead={l} />)}
              </LeadList>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
