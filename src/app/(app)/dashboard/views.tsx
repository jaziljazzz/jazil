"use client";

import { AlertTriangle, ArrowLeft, Recycle, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge, Card, Chip, cn, Input, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { aed, fmtDate, num } from "@/lib/format";
import type { AgentMetrics, Deal, Stage } from "@/lib/types";
import { STAGES, STAGE_META } from "@/lib/constants";
import { CommissionChart, Funnel, SourceChart } from "./charts";

function DateFilter({ preset, params }: { preset: string; params: Record<string, string | undefined> }) {
  const router = useRouter();
  const path = usePathname();
  const go = (patch: Record<string, string | undefined>) => {
    const usp = new URLSearchParams();
    Object.entries({ ...params, ...patch }).forEach(([k, v]) => v && usp.set(k, v));
    router.replace(`${path}?${usp}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[["today", "Today"], ["week", "Week"], ["month", "Month"], ["custom", "Custom"]].map(([k, l]) => (
        <Chip key={k} active={preset === k} onClick={() => go({ range: k })}>{l}</Chip>
      ))}
      {preset === "custom" && (
        <>
          <Input type="date" className="w-40" value={params.from ?? ""} onChange={(e) => go({ from: e.target.value })} />
          <Input type="date" className="w-40" value={params.to ?? ""} onChange={(e) => go({ to: e.target.value })} />
        </>
      )}
    </div>
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const mins = (m: number | null) => (m === null || m === undefined || Number(m) < 0 ? "—" : m < 60 ? `${Math.round(m)}m` : `${(m / 60).toFixed(1)}h`);

export function FounderDashboard({ preset, label, params, rows, teamOverdue, funnel, sources, commission, rejections, overdueDeals, recycleCount, slaToday }: {
  preset: string; label: string; params: Record<string, string | undefined>; rows: AgentMetrics[]; teamOverdue: number;
  funnel: { stage: Stage; count: number }[];
  sources: { source: string; label: string; leads: number; won: number; commission: number; cost: number | null }[];
  commission: { month: string; earned: number; received: number; pending: number }[];
  rejections: { reason: string; count: number }[]; overdueDeals: Deal[]; recycleCount: number; slaToday: { id: string; name: string; owner_id: string }[];
}) {
  const router = useRouter();
  const sum = (k: keyof AgentMetrics) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const sorted = [...rows].sort((a, b) => Number(b.overdue) - Number(a.overdue));
  const leaderboard = [...rows].filter((r) => Number(r.units_sold) || Number(r.commission_earned)).sort((a, b) => Number(b.commission_earned) - Number(a.commission_earned)).slice(0, 5);
  const names = Object.fromEntries(rows.map((r) => [r.agent_id, r.agent_name]));
  const agentHref = (id: string) => `/dashboard?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>), agent: id })}`;

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 md:px-8 md:py-8">
      <PageHeader title="Founder dashboard" sub={label} actions={<DateFilter preset={preset} params={params} />} />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Leads in" value={num(sum("leads_assigned"))} />
        <StatCard label="Contacted" value={num(sum("contacted"))} sub={`${num(sum("calls"))} calls`} />
        <StatCard label="Overdue (team, now)" value={num(teamOverdue)} tone={teamOverdue ? "danger" : "success"} href="/leads?view=overdue" />
        <StatCard label="Units sold" value={num(sum("units_sold"))} />
        <StatCard label="Commission earned" value={aed(sum("commission_earned"), true)} tone="success" />
        <StatCard label="Commission received" value={aed(sum("commission_received"), true)} />
      </div>

      {/* Agent table */}
      <section className="mt-6">
        <SectionTitle>Agents</SectionTitle>
        <div className="space-y-2 md:hidden">
          {sorted.map((r) => (
            <Link key={r.agent_id} href={agentHref(r.agent_id)}>
              <Card className="mb-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.agent_name} {r.on_leave && <Badge>On leave</Badge>}</span>
                  <span className={cn("tabular text-[15px] font-semibold", Number(r.overdue) ? "text-danger" : "text-success")}>{r.overdue} overdue</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px] text-muted">
                  <div><div className="tabular text-[15px] font-semibold text-ink">{r.leads_assigned}</div>Leads</div>
                  <div><div className="tabular text-[15px] font-semibold text-ink">{r.calls}</div>Calls</div>
                  <div><div className="tabular text-[15px] font-semibold text-ink">{r.units_sold}</div>Sold</div>
                  <div><div className="tabular text-[15px] font-semibold text-ink">{aed(r.commission_earned, true).replace("AED ", "")}</div>Comm.</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-[12px] border border-line bg-surface md:block">
          <table className="w-full whitespace-nowrap text-[13px]">
            <thead className="border-b border-line bg-bg/60 text-left text-[12px] text-muted">
              <tr>
                {["Agent", "Leads", "Contacted", "Calls (conn / not)", "Follow ups done / due", "Overdue", "Untouched", "Meetings", "Sold", "Sale value", "Comm. earned", "Comm. received", "Conversion", "1st response"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {sorted.map((r) => (
                <tr key={r.agent_id} onClick={() => router.push(agentHref(r.agent_id))} className="cursor-pointer border-b border-line last:border-0 hover:bg-bg">
                  <td className="px-3 py-2.5 font-medium">{r.agent_name} {r.on_leave && <Badge>Leave</Badge>}</td>
                  <td className="px-3 py-2.5">{r.leads_assigned}</td>
                  <td className="px-3 py-2.5">{r.contacted}</td>
                  <td className="px-3 py-2.5">{r.calls} <span className="text-muted">({r.calls_connected} / {Number(r.calls) - Number(r.calls_connected)})</span></td>
                  <td className="px-3 py-2.5">{r.followups_done} / {r.followups_due}</td>
                  <td className={cn("px-3 py-2.5 font-semibold", Number(r.overdue) ? "bg-danger-50 text-danger" : "text-success")}>{r.overdue}</td>
                  <td className={cn("px-3 py-2.5", Number(r.untouched) > 0 && "text-info")}>{r.untouched}</td>
                  <td className="px-3 py-2.5">{r.meetings_done} / {r.meetings_scheduled}</td>
                  <td className="px-3 py-2.5">{r.units_sold}</td>
                  <td className="px-3 py-2.5">{aed(r.sale_value, true)}</td>
                  <td className="px-3 py-2.5 text-success">{aed(r.commission_earned, true)}</td>
                  <td className="px-3 py-2.5">{aed(r.commission_received, true)}</td>
                  <td className="px-3 py-2.5">{pct(Number(r.units_sold), Number(r.leads_assigned))}</td>
                  <td className="px-3 py-2.5">{mins(r.avg_first_response_minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 hidden text-[12px] text-muted md:block">Leads by stage per agent: {rows.map((r) => `${r.agent_name.split(" ")[0]} ${STAGES.map((s) => r[`st_${s}` as keyof AgentMetrics]).join("/")}`).join(" · ")} (New/Contacted/Shortlisting/Meeting/Negotiation/Won/Lost)</p>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><SectionTitle>Pipeline funnel</SectionTitle><Funnel data={funnel} /></Card>
        <Card className="p-4"><SectionTitle>Commission by month</SectionTitle><CommissionChart data={commission} /></Card>
        <Card className="p-4">
          <SectionTitle>Lead source performance</SectionTitle>
          {sources.length ? <SourceChart data={sources} /> : <p className="text-[13px] text-muted">No leads in this period</p>}
          <div className="mt-3 divide-y divide-line md:hidden">
            {sources.map((s) => (
              <div key={s.source + s.label} className="py-2.5">
                <p className="break-words text-[13px] font-medium">{s.label}</p>
                <p className="tabular mt-0.5 text-[12px] text-muted">
                  {s.leads} leads · {s.won} won · <span className="text-success">{aed(s.commission, true)}</span>
                  {s.cost ? ` · ${Number(s.won) ? `${aed(Number(s.cost) / Number(s.won), true)}/deal` : `${aed(s.cost, true)} spent`}` : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full whitespace-nowrap text-[12px]">
              <thead className="text-left text-muted"><tr><th className="py-1 font-medium">Source</th><th className="font-medium">Leads</th><th className="font-medium">Won</th><th className="font-medium">Commission</th><th className="font-medium">Cost / deal</th></tr></thead>
              <tbody className="tabular">
                {sources.map((s) => (
                  <tr key={s.source + s.label} className="border-t border-line">
                    <td className="py-1.5">{s.label}</td><td>{s.leads}</td><td>{s.won}</td><td>{aed(s.commission, true)}</td>
                    <td>{s.cost ? (Number(s.won) ? aed(Number(s.cost) / Number(s.won), true) : `${aed(s.cost, true)} spent`) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle>Alerts</SectionTitle>
            <div className="space-y-2 text-[13px]">
              <Link href="/recycle" className="flex items-center justify-between rounded-lg bg-warning-50 px-3 py-2 text-warning"><span className="flex items-center gap-2"><Recycle className="size-4" /> Leads in recycle pool</span><span className="tabular font-semibold">{recycleCount}</span></Link>
              <div className="rounded-lg bg-danger-50 px-3 py-2 text-danger">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><AlertTriangle className="size-4" /> SLA breaches today</span><span className="tabular font-semibold">{slaToday.length}</span></div>
                {slaToday.slice(0, 5).map((l) => <Link key={l.id} href={`/leads/${l.id}`} className="block pl-6 text-[12px] underline-offset-2 hover:underline">{l.name} · {names[l.owner_id] ?? ""}</Link>)}
              </div>
              <div className="rounded-lg border border-line px-3 py-2">
                <div className="flex items-center justify-between"><span>Overdue commissions</span><span className={cn("tabular font-semibold", overdueDeals.length > 0 && "text-danger")}>{overdueDeals.length}</span></div>
                {overdueDeals.slice(0, 6).map((d) => (
                  <div key={d.id} className="mt-1 flex justify-between text-[12px] text-muted">
                    <span>{d.project} · {d.lead?.name}</span><span className="tabular">{aed(d.commission_amount, true)} · due {d.expected_commission_date && fmtDate(d.expected_commission_date)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <SectionTitle>Leaderboard</SectionTitle>
            {leaderboard.length === 0 && <p className="text-[13px] text-muted">No deals in this period yet</p>}
            {leaderboard.map((r, i) => (
              <div key={r.agent_id} className="flex items-center justify-between border-t border-line py-2 text-[13px] first:border-0">
                <span className="flex items-center gap-2">{i === 0 ? <Trophy className="size-4 text-warning" /> : <span className="w-4 text-center text-muted">{i + 1}</span>}{r.agent_name}</span>
                <span className="tabular">{r.units_sold} units · <span className="font-semibold text-success">{aed(r.commission_earned, true)}</span></span>
              </div>
            ))}
          </Card>
          <Card className="p-4">
            <SectionTitle>Top rejection reasons</SectionTitle>
            {rejections.length === 0 && <p className="text-[13px] text-muted">No rejected units yet</p>}
            {rejections.map((r) => (
              <div key={r.reason} className="flex justify-between border-t border-line py-1.5 text-[13px] first:border-0"><span>{r.reason}</span><span className="tabular font-medium">{r.count}</span></div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function AgentDashboard({ name, isFounderView, preset, label, params, me, month, myDay }: {
  name: string; isFounderView: boolean; preset: string; label: string; params: Record<string, string | undefined>;
  me: AgentMetrics | null; month: AgentMetrics | null; myDay: { overdue: number; dueToday: number; untouched: number; meetingsWeek: number };
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-4 md:px-8 md:py-8">
      {isFounderView && <Link href="/dashboard" className="mb-3 flex items-center gap-1 text-[13px] text-muted"><ArrowLeft className="size-4" /> Founder dashboard</Link>}
      <PageHeader title={isFounderView ? name : "My numbers"} sub={label} actions={<DateFilter preset={preset} params={params} />} />
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Overdue" value={myDay.overdue} tone="danger" href={isFounderView ? `/leads?view=overdue&agent=${params.agent}` : "/today"} />
        <StatCard label="Due today" value={myDay.dueToday} tone="warning" href={isFounderView ? undefined : "/today"} />
        <StatCard label="Untouched" value={myDay.untouched} tone="info" href={isFounderView ? undefined : "/today"} />
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatCard label={`Calls · ${label}`} value={me?.calls ?? 0} sub={`${me?.calls_connected ?? 0} connected`} />
        <StatCard label={`Contacted · ${label}`} value={me?.contacted ?? 0} />
        <StatCard label="Meetings this week" value={myDay.meetingsWeek} />
        <StatCard label={`Leads in · ${label}`} value={me?.leads_assigned ?? 0} />
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <StatCard label="Units sold this month" value={month?.units_sold ?? 0} />
        <StatCard label="Commission earned this month" value={aed(month?.commission_earned ?? 0, true)} tone="success" />
        <StatCard label="Commission received this month" value={aed(month?.commission_received ?? 0, true)} />
      </div>
      <Card className="mt-4 p-4">
        <SectionTitle>Leads by stage</SectionTitle>
        <Funnel data={STAGES.map((s) => ({ stage: s, count: Number(me?.[`st_${s}` as keyof AgentMetrics] ?? 0) }))} />
        <p className="mt-3 text-[12px] text-muted">Follow ups done on time: {me?.followups_done ?? 0} of {me?.followups_due ?? 0} · Avg first response {mins(me?.avg_first_response_minutes ?? null)}</p>
      </Card>
      <div className="mt-4 flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <Link key={s} href={`/leads?view=${s}${isFounderView ? `&agent=${params.agent}` : ""}`} className="text-[12px] font-medium" style={{ color: STAGE_META[s].color }}>{STAGE_META[s].label} →</Link>
        ))}
      </div>
    </div>
  );
}
