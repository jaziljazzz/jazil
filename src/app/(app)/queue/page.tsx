import { getSession, LEAD_LIST_FIELDS } from "@/lib/session";
import { endOfDay } from "@/lib/format";
import type { Lead } from "@/lib/types";
import { TaskQueue } from "./queue";

export const metadata = { title: "Calls" };
export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const { supabase, profile } = await getSession();
  const eod = endOfDay().toISOString();
  const fields = LEAD_LIST_FIELDS.replace("requirements(budget_min,budget_max,area,bedrooms)", "requirements(*)");
  const [{ data: due }, { data: untouched }] = await Promise.all([
    supabase.from("leads").select(fields).eq("owner_id", profile.id).not("stage", "in", "(won,lost)")
      .not("next_followup_at", "is", null).lt("next_followup_at", eod).order("next_followup_at").limit(200),
    supabase.from("leads").select(fields).eq("owner_id", profile.id).eq("stage", "new")
      .is("first_called_at", null).is("next_followup_at", null).order("assigned_at").limit(200),
  ]);
  const leads = [...((due ?? []) as unknown as Lead[]), ...((untouched ?? []) as unknown as Lead[])];
  const ids = leads.map((l) => l.id);
  const { data: notes } = ids.length
    ? await supabase.from("activities").select("lead_id,note,created_at").in("lead_id", ids).not("note", "is", null)
        .in("type", ["call", "note"]).order("created_at", { ascending: false }).limit(1000)
    : { data: [] };
  const lastNote: Record<string, string> = {};
  (notes ?? []).forEach((n: { lead_id: string; note: string }) => { if (!lastNote[n.lead_id]) lastNote[n.lead_id] = n.note; });
  return <TaskQueue leads={leads} lastNote={lastNote} />;
}
