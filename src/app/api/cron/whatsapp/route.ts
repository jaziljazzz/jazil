import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validHook } from "@/lib/server/hook";
import { getIntegrations, sendWaTemplate } from "@/lib/server/integrations";
import { endOfDay, startOfDay } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Morning (9 AM Dubai): each agent gets overdue / due today / untouched on WhatsApp.
 * Evening (7 PM Dubai): the founder gets calls, contacted and overdue per agent.
 * Templates (approve in Meta WhatsApp Manager, category Utility):
 *   aventus_morning_summary: "Good morning {{1}}. Today: {{2}} overdue, {{3}} due today, {{4}} new untouched leads. Open the CRM to start calling."
 *   aventus_team_summary:    "Team summary for {{1}}: {{2}}"
 */
export async function POST(req: Request) {
  if (!validHook(req)) return new NextResponse("Forbidden", { status: 403 });
  const { kind } = await req.json();
  const cfg = await getIntegrations();
  if (!cfg.wa_enabled || !cfg.wa_token || !cfg.wa_phone_number_id) return NextResponse.json({ skipped: "WhatsApp not configured" });
  const admin = supabaseAdmin();
  const now = new Date();
  const { data: people } = await admin.from("profiles").select("id,name,phone,role,active,on_leave").eq("active", true);
  const results: unknown[] = [];

  if (kind === "morning" && cfg.wa_template_morning) {
    for (const p of (people ?? []).filter((x) => x.role === "agent" && !x.on_leave && x.phone)) {
      const base = () => admin.from("leads").select("id", { count: "exact", head: true }).eq("owner_id", p.id);
      const [o, d, u] = await Promise.all([
        base().not("stage", "in", "(won,lost)").lt("next_followup_at", now.toISOString()),
        base().not("stage", "in", "(won,lost)").gte("next_followup_at", now.toISOString()).lt("next_followup_at", endOfDay(now).toISOString()),
        base().eq("stage", "new").is("first_called_at", null),
      ]);
      const r = await sendWaTemplate(cfg, p.phone!, cfg.wa_template_morning, [p.name.split(" ")[0]!, String(o.count ?? 0), String(d.count ?? 0), String(u.count ?? 0)]);
      results.push({ to: p.name, ok: r.ok, error: r.ok ? undefined : r.body?.error?.message });
    }
  }

  if (kind === "evening" && cfg.wa_template_evening) {
    const start = startOfDay(now).toISOString();
    const lines: string[] = [];
    for (const p of (people ?? []).filter((x) => x.role === "agent")) {
      const [calls, overdue] = await Promise.all([
        admin.from("activities").select("lead_id").eq("user_id", p.id).eq("type", "call").gte("created_at", start),
        admin.from("leads").select("id", { count: "exact", head: true }).eq("owner_id", p.id).not("stage", "in", "(won,lost)").lt("next_followup_at", now.toISOString()),
      ]);
      const c = calls.data ?? [];
      lines.push(`${p.name.split(" ")[0]} ${c.length} calls, ${new Set(c.map((x) => x.lead_id)).size} contacted, ${overdue.count ?? 0} overdue`);
    }
    const day = new Intl.DateTimeFormat("en-GB", { timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Dubai", day: "numeric", month: "short" }).format(now);
    for (const f of (people ?? []).filter((x) => x.role === "founder" && x.phone)) {
      const r = await sendWaTemplate(cfg, f.phone!, cfg.wa_template_evening, [day, lines.join(" | ") || "No agents yet"]);
      results.push({ to: f.name, ok: r.ok, error: r.ok ? undefined : r.body?.error?.message });
    }
  }
  return NextResponse.json({ results });
}
