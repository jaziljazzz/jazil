import { getTeam, LEAD_LIST_FIELDS, requireFounder } from "@/lib/session";
import type { Lead } from "@/lib/types";
import { RecycleView } from "./view";

export const metadata = { title: "Recycle pool" };
export const dynamic = "force-dynamic";

export default async function RecyclePage() {
  const { supabase } = await requireFounder();
  const [pool, untouched, stale, team] = await Promise.all([
    supabase.from("leads").select(LEAD_LIST_FIELDS).eq("in_recycle_pool", true).not("stage", "in", "(won,lost)").order("last_activity_at").limit(500),
    supabase.from("leads").select(LEAD_LIST_FIELDS).eq("needs_founder_attention", true).not("stage", "in", "(won,lost)").order("assigned_at").limit(500),
    supabase.from("leads").select(LEAD_LIST_FIELDS).eq("is_stale", true).eq("in_recycle_pool", false).not("stage", "in", "(won,lost)").order("last_activity_at").limit(500),
    getTeam(),
  ]);
  return <RecycleView pool={(pool.data ?? []) as Lead[]} flagged={(untouched.data ?? []) as Lead[]} stale={(stale.data ?? []) as Lead[]} team={team} />;
}
