import { getSession, getTeam } from "@/lib/session";
import type { Deal } from "@/lib/types";
import { DealsView } from "./deals-view";

export const metadata = { title: "Deals" };
export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const { supabase, isFounder } = await getSession();
  const { data } = await supabase
    .from("deals")
    .select("*, lead:leads(name,phone), developer:developers(name), agent:profiles!deals_agent_id_fkey(name)")
    .order("booking_date", { ascending: false })
    .limit(1000);
  const team = isFounder ? await getTeam() : [];
  return <DealsView deals={(data ?? []) as Deal[]} team={team} />;
}
