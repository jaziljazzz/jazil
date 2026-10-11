import { getSession, getSettings, getTeam, LEAD_LIST_FIELDS } from "@/lib/session";
import type { Lead } from "@/lib/types";
import { Board } from "./board";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const { agent } = await searchParams;
  const { supabase, isFounder } = await getSession();
  const settings = await getSettings();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  let open = supabase.from("leads").select(LEAD_LIST_FIELDS).not("stage", "in", "(won,lost)").order("next_followup_at", { ascending: true, nullsFirst: true }).limit(1500);
  let closed = supabase.from("leads").select(LEAD_LIST_FIELDS).in("stage", ["won", "lost"]).gte("last_activity_at", since).order("last_activity_at", { ascending: false }).limit(300);
  if (agent && isFounder) {
    open = open.eq("owner_id", agent);
    closed = closed.eq("owner_id", agent);
  }
  const [{ data: o }, { data: c }] = await Promise.all([open, closed]);
  const team = isFounder ? (await getTeam()).filter((t) => t.active) : [];
  return <Board leads={[...((o ?? []) as Lead[]), ...((c ?? []) as Lead[])]} team={team} agent={agent ?? ""} staleDays={settings.stale_days} />;
}
