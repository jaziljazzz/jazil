import { getSession, getTeam, LEAD_LIST_FIELDS } from "@/lib/session";
import { endOfDay, fmtWeekday } from "@/lib/format";
import type { Lead } from "@/lib/types";
import { MyDay } from "./my-day";

export const metadata = { title: "My Day" };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { supabase, profile, isFounder } = await getSession();
  const now = new Date();
  const eod = endOfDay(now).toISOString();

  // My Day is always the signed-in user's own work, even for the founder.
  const [{ data: due }, { data: untouched }] = await Promise.all([
    supabase.from("leads").select(LEAD_LIST_FIELDS).eq("owner_id", profile.id)
      .not("stage", "in", "(won,lost)").not("next_followup_at", "is", null).lt("next_followup_at", eod)
      .order("next_followup_at").limit(300),
    supabase.from("leads").select(LEAD_LIST_FIELDS).eq("owner_id", profile.id)
      .eq("stage", "new").is("first_called_at", null).is("next_followup_at", null)
      .order("assigned_at").limit(300),
  ]);

  const nowIso = now.toISOString();
  const overdue = ((due ?? []) as Lead[]).filter((l) => l.next_followup_at! < nowIso);
  const today = ((due ?? []) as Lead[]).filter((l) => l.next_followup_at! >= nowIso);

  let team: { overdue: number; byAgent: { id: string; name: string; overdue: number }[] } | null = null;
  if (isFounder) {
    const { data } = await supabase.from("leads").select("owner_id").not("stage", "in", "(won,lost)").lt("next_followup_at", nowIso);
    const members = await getTeam();
    const counts = new Map<string, number>();
    (data ?? []).forEach((r: { owner_id: string | null }) => r.owner_id && counts.set(r.owner_id, (counts.get(r.owner_id) ?? 0) + 1));
    team = {
      overdue: data?.length ?? 0,
      byAgent: members.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name, overdue: counts.get(m.id) ?? 0 })).sort((a, b) => b.overdue - a.overdue),
    };
  }

  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Dubai", hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <MyDay
      greeting={`${greeting}, ${profile.name.split(" ")[0]}`}
      date={fmtWeekday(now)}
      overdue={overdue}
      today={today}
      untouched={(untouched ?? []) as Lead[]}
      team={team}
    />
  );
}
