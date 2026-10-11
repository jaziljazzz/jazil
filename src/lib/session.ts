import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import type { Developer, Profile, Settings } from "./types";

export const getSession = cache(async () => {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || !profile.active) redirect("/login?error=inactive");
  return { supabase, user, profile, isFounder: profile.role === "founder" };
});

export const getSettings = cache(async () => {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single<Settings>();
  return data!;
});

export const getTeam = cache(async () => {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("profiles").select("*").order("round_robin_order");
  return (data ?? []) as Profile[];
});

export const getDevelopers = cache(async () => {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("developers").select("*").order("name");
  return (data ?? []) as Developer[];
});

export async function requireFounder() {
  const s = await getSession();
  if (!s.isFounder) redirect("/today");
  return s;
}

export const LEAD_LIST_FIELDS =
  "id,name,phone,source,stage,owner_id,next_followup_at,last_activity_at,first_called_at,assigned_at,attempt_count,sla_breached,is_stale,in_recycle_pool,needs_founder_attention,campaign,selected_project,selected_unit,lost_reason,created_at,batch_id,requirements(budget_min,budget_max,area,bedrooms)";
