import { getTeam, requireFounder } from "@/lib/session";
import { TeamView } from "./view";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { supabase } = await requireFounder();
  const team = await getTeam();
  const { data } = await supabase.from("leads").select("owner_id").not("stage", "in", "(won,lost)");
  const open: Record<string, number> = {};
  (data ?? []).forEach((r: { owner_id: string | null }) => { if (r.owner_id) open[r.owner_id] = (open[r.owner_id] ?? 0) + 1; });
  return <TeamView team={team} openLeads={open} />;
}
