import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import type { Developer, Profile, Settings } from "./types";

export const getSession = cache(async () => {
  const supabase = await supabaseServer();
  // The middleware already verified this request's session with Supabase Auth (getUser), so here we only
  // read the cookie instead of paying a second network round trip. Row level security still checks the JWT.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
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

export { LEAD_CARD_FIELDS as LEAD_LIST_FIELDS } from "./fields";
