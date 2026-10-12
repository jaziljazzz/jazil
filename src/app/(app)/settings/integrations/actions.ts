"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getIntegrations, GRAPH, sendWaTemplate } from "@/lib/server/integrations";

async function founder() {
  const s = await getSession();
  if (!s.isFounder) throw new Error("Founder only");
  return s;
}

export async function saveIntegrations(patch: Record<string, string | boolean | null>) {
  const { supabase } = await founder();
  const allowed = ["meta_page_id", "meta_page_token", "meta_app_secret", "wa_enabled", "wa_token", "wa_phone_number_id", "wa_template_morning", "wa_template_evening", "wa_lang"];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v]));
  const { error } = await supabase.from("integrations").update(clean).eq("id", 1);
  revalidatePath("/settings/integrations");
  return error ? { error: error.message } : { ok: true };
}

/** Checks the Page token and subscribes the app to this Page's lead forms. */
export async function connectMeta() {
  await founder();
  const cfg = await getIntegrations();
  if (!cfg.meta_page_id || !cfg.meta_page_token) return { error: "Add the Page ID and Page access token first" };
  const page = await fetch(`${GRAPH}/${cfg.meta_page_id}?fields=name&access_token=${encodeURIComponent(cfg.meta_page_token)}`).then((r) => r.json());
  if (page.error) return { error: `Meta says: ${page.error.message}` };
  const sub = await fetch(`${GRAPH}/${cfg.meta_page_id}/subscribed_apps?subscribed_fields=leadgen&access_token=${encodeURIComponent(cfg.meta_page_token)}`, { method: "POST" }).then((r) => r.json());
  if (sub.error) return { error: `Connected to "${page.name}" but could not subscribe to leads: ${sub.error.message}` };
  return { ok: true, message: `Connected to Facebook Page "${page.name}". New lead form submissions will arrive instantly.` };
}

/** Sends the morning template to the founder's own phone as a test. */
export async function testWhatsApp() {
  const { profile } = await founder();
  const cfg = await getIntegrations();
  if (!cfg.wa_token || !cfg.wa_phone_number_id || !cfg.wa_template_morning) return { error: "Add the access token, phone number ID and template name first" };
  if (!profile.phone) return { error: "Add your mobile number to your profile (Team page) first" };
  const r = await sendWaTemplate(cfg, profile.phone, cfg.wa_template_morning, [profile.name.split(" ")[0]!, "2", "3", "1"]);
  return r.ok ? { ok: true, message: `Test sent to ${profile.phone}` } : { error: r.body?.error?.message ?? "WhatsApp rejected the message" };
}
