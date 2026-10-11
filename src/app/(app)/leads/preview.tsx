import Link from "next/link";
import { getSession } from "@/lib/session";
import type { Activity, Lead } from "@/lib/types";
import { PreviewClient } from "./preview-client";

export async function LeadPreview({ id }: { id: string }) {
  const { supabase } = await getSession();
  const [{ data: lead }, { data: acts }] = await Promise.all([
    supabase.from("leads").select("*, owner:profiles!leads_owner_id_fkey(name), requirements(*)").eq("id", id).maybeSingle(),
    supabase.from("activities").select("*, user:profiles!activities_user_id_fkey(name)").eq("lead_id", id).order("created_at", { ascending: false }).limit(12),
  ]);
  if (!lead) return <p className="p-4 text-[13px] text-muted">Lead not found. <Link href="/leads" className="text-brand">Back</Link></p>;
  return <PreviewClient lead={lead as Lead} activities={(acts ?? []) as Activity[]} />;
}
