"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getIntegrations, sendWaTemplate } from "@/lib/server/integrations";
import { connectPage, disconnectMeta, syncRecentLeads } from "@/lib/server/meta";
import { headers } from "next/headers";

async function founder() {
  const s = await getSession();
  if (!s.isFounder) throw new Error("Founder only");
  return s;
}
async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}
const done = <T extends object>(r: T): T & { error?: string; message?: string } => { revalidatePath("/connectors"); return r; };

export async function saveMetaApp(v: { meta_app_id: string; meta_app_secret: string; meta_login_config_id: string }) {
  await founder();
  const patch: Record<string, string | null> = { meta_app_id: v.meta_app_id.trim() || null, meta_login_config_id: v.meta_login_config_id.trim() || null };
  if (v.meta_app_secret.trim()) patch.meta_app_secret = v.meta_app_secret.trim();
  const { error } = await supabaseAdmin().from("integrations").update(patch).eq("id", 1);
  return done(error ? { error: error.message } : { ok: true });
}

export async function pickMetaPage(pageId: string) {
  await founder();
  const cfg = await getIntegrations();
  const page = cfg.meta_pages_pending?.find((p) => p.id === pageId);
  if (!page) return { error: "That Page is no longer available, please connect again" };
  try {
    await connectPage(cfg, page, cfg.meta_user_name, await origin());
    return done({ ok: true });
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function disconnectMetaAction() {
  await founder();
  await disconnectMeta();
  return done({ ok: true });
}

export async function syncMetaLeads() {
  await founder();
  try {
    const r = await syncRecentLeads();
    return done({ ok: true, message: `Checked ${r.forms} form${r.forms === 1 ? "" : "s"}: ${r.created} new lead${r.created === 1 ? "" : "s"} added, ${r.duplicates} already in the CRM.` });
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveWhatsApp(v: Record<string, string | boolean>) {
  await founder();
  const allowed = ["wa_enabled", "wa_token", "wa_phone_number_id", "wa_template_morning", "wa_template_evening", "wa_lang"];
  const patch = Object.fromEntries(Object.entries(v).filter(([k, x]) => allowed.includes(k) && x !== "").map(([k, x]) => [k, typeof x === "string" ? x.trim() : x]));
  const { error } = await supabaseAdmin().from("integrations").update(patch).eq("id", 1);
  return done(error ? { error: error.message } : { ok: true });
}

export async function testWhatsAppAction() {
  const { profile } = await founder();
  const cfg = await getIntegrations();
  if (!cfg.wa_token || !cfg.wa_phone_number_id || !cfg.wa_template_morning) return { error: "Add the access token, phone number ID and template name first" };
  if (!profile.phone) return { error: "Add your mobile number to your profile first" };
  const r = await sendWaTemplate(cfg, profile.phone, cfg.wa_template_morning, [profile.name.split(" ")[0]!, "2", "3", "1"]);
  return r.ok ? { ok: true, message: `Test message sent to ${profile.phone}` } : { error: r.body?.error?.message ?? "WhatsApp rejected the message" };
}

export async function disconnectWhatsApp() {
  await founder();
  await supabaseAdmin().from("integrations").update({ wa_enabled: false, wa_token: null }).eq("id", 1);
  return done({ ok: true });
}
