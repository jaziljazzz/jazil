import { getSession, getTeam } from "@/lib/session";
import { addDays, endOfDay, rangeFor, startOfDay } from "@/lib/format";
import { STAGES } from "@/lib/constants";
import type { AgentMetrics, Deal } from "@/lib/types";
import { AgentDashboard, FounderDashboard } from "./views";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type Q = { range?: string; from?: string; to?: string; agent?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Q> }) {
  const sp = await searchParams;
  const { supabase, isFounder, profile } = await getSession();
  const preset = sp.range || (isFounder ? "month" : "today");
  const r = rangeFor(preset, sp.from, sp.to);
  const args = { p_from: r.from.toISOString(), p_to: r.to.toISOString() };

  const { data: metrics } = await supabase.rpc("agent_metrics", args);
  const rows = (metrics ?? []) as AgentMetrics[];
  const viewAgent = isFounder ? sp.agent : profile.id;

  if (!isFounder || viewAgent) {
    const me = rows.find((m) => m.agent_id === (viewAgent ?? profile.id));
    const now = new Date();
    const eod = endOfDay(now).toISOString();
    const owner = viewAgent ?? profile.id;
    const [{ count: overdue }, { count: dueToday }, { count: untouched }, { count: meetingsWeek }, month] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("owner_id", owner).not("stage", "in", "(won,lost)").lt("next_followup_at", now.toISOString()),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("owner_id", owner).not("stage", "in", "(won,lost)").gte("next_followup_at", now.toISOString()).lt("next_followup_at", eod),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("owner_id", owner).eq("stage", "new").is("first_called_at", null),
      supabase.from("meetings").select("id", { count: "exact", head: true }).eq("user_id", owner).gte("scheduled_at", startOfDay(now).toISOString()).lt("scheduled_at", addDays(startOfDay(now), 7).toISOString()),
      supabase.rpc("agent_metrics", { p_from: rangeFor("month").from.toISOString(), p_to: rangeFor("month").to.toISOString() }),
    ]);
    const monthRow = ((month.data ?? []) as AgentMetrics[]).find((m) => m.agent_id === owner);
    const team = isFounder ? await getTeam() : [];
    return (
      <AgentDashboard
        name={team.find((t) => t.id === owner)?.name ?? profile.name}
        isFounderView={isFounder}
        preset={preset} label={r.label} params={sp}
        me={me ?? null}
        month={monthRow ?? null}
        myDay={{ overdue: overdue ?? 0, dueToday: dueToday ?? 0, untouched: untouched ?? 0, meetingsWeek: meetingsWeek ?? 0 }}
      />
    );
  }

  const [funnel, sources, commission, rejections, overdueDeals, recycle, sla] = await Promise.all([
    Promise.all(STAGES.map((s) => supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", s))),
    supabase.rpc("source_performance", args),
    supabase.rpc("commission_by_month", { p_months: 12 }),
    supabase.rpc("top_rejection_reasons"),
    supabase.from("deals").select("*, lead:leads(name), agent:profiles!deals_agent_id_fkey(name)").eq("cancelled", false).eq("commission_status", "pending")
      .lt("expected_commission_date", new Date().toISOString().slice(0, 10)).order("expected_commission_date").limit(20),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("in_recycle_pool", true).not("stage", "in", "(won,lost)"),
    supabase.from("leads").select("id,name,owner_id").eq("sla_breached", true).gte("assigned_at", startOfDay().toISOString()).limit(20),
  ]);

  const teamOverdue = (await supabase.from("leads").select("id", { count: "exact", head: true }).not("stage", "in", "(won,lost)").lt("next_followup_at", new Date().toISOString())).count ?? 0;

  return (
    <FounderDashboard
      preset={preset} label={r.label} params={sp}
      rows={rows}
      teamOverdue={teamOverdue}
      funnel={STAGES.map((s, i) => ({ stage: s, count: funnel[i]?.count ?? 0 }))}
      sources={(sources.data ?? []) as { source: string; label: string; leads: number; won: number; commission: number; cost: number | null }[]}
      commission={(commission.data ?? []) as { month: string; earned: number; received: number; pending: number }[]}
      rejections={(rejections.data ?? []) as { reason: string; count: number }[]}
      overdueDeals={(overdueDeals.data ?? []) as Deal[]}
      recycleCount={recycle.count ?? 0}
      slaToday={(sla.data ?? []) as { id: string; name: string; owner_id: string }[]}
    />
  );
}
