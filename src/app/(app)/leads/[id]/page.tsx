import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import type { Activity, Deal, Lead, Meeting, Requirement, ShortlistedUnit } from "@/lib/types";
import { LeadDetail } from "./lead-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getSession();
  const { data } = await supabase.from("leads").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Lead" };
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getSession();
  // Everything is keyed by the lead id, so fetch it all in one parallel round.
  const [{ data: lead }, req, units, acts, meetings, deals] = await Promise.all([
    supabase.from("leads").select("*, owner:profiles!leads_owner_id_fkey(name), batch:lead_batches(name)").eq("id", id).maybeSingle(),
    supabase.from("requirements").select("*").eq("lead_id", id).maybeSingle(),
    supabase.from("shortlisted_units").select("*").eq("lead_id", id).order("created_at"),
    supabase.from("activities").select("*, user:profiles!activities_user_id_fkey(name)").eq("lead_id", id).order("created_at", { ascending: false }).limit(500),
    supabase.from("meetings").select("*").eq("lead_id", id).order("scheduled_at", { ascending: false }),
    supabase.from("deals").select("*, developer:developers(name), agent:profiles!deals_agent_id_fkey(name)").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);
  if (!lead) notFound();
  return (
    <LeadDetail
      lead={lead as Lead & { batch?: { name: string } | null }}
      requirement={(req.data ?? null) as Requirement | null}
      units={(units.data ?? []) as ShortlistedUnit[]}
      activities={(acts.data ?? []) as Activity[]}
      meetings={(meetings.data ?? []) as Meeting[]}
      deals={(deals.data ?? []) as Deal[]}
    />
  );
}
