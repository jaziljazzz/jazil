import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getIntegrations, GRAPH, type Integrations } from "./integrations";

export const META_DIALOG = process.env.META_DIALOG_URL || "https://www.facebook.com/v21.0/dialog/oauth";
export const META_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "pages_manage_ads", "leads_retrieval", "business_management"];

type Page = { id: string; name: string; access_token: string };

async function graph<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error?.message || `Meta request failed (${res.status})`);
  return body as T;
}

export function metaReady(cfg: Integrations) {
  return !!(cfg.meta_app_id && cfg.meta_app_secret);
}

/** Facebook Login → long-lived user token → the Pages this person manages. */
export async function pagesFromCode(cfg: Integrations, code: string, redirectUri: string) {
  const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const short = await graph<{ access_token: string }>(`/oauth/access_token?${q({ client_id: cfg.meta_app_id!, client_secret: cfg.meta_app_secret!, redirect_uri: redirectUri, code })}`);
  const long = await graph<{ access_token: string }>(`/oauth/access_token?${q({ grant_type: "fb_exchange_token", client_id: cfg.meta_app_id!, client_secret: cfg.meta_app_secret!, fb_exchange_token: short.access_token })}`);
  const me = await graph<{ name: string }>(`/me?fields=name&access_token=${encodeURIComponent(long.access_token)}`);
  const pages = await graph<{ data: Page[] }>(`/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(long.access_token)}`);
  return { userName: me.name, pages: pages.data ?? [] };
}

/** Subscribes the app to the Page's lead forms and points Meta's webhook at this CRM, then saves the connection. */
export async function connectPage(cfg: Integrations, page: Page, userName: string | null, origin: string) {
  await graph(`/${page.id}/subscribed_apps?subscribed_fields=leadgen&access_token=${encodeURIComponent(page.access_token)}`, { method: "POST" });
  const appToken = `${cfg.meta_app_id}|${cfg.meta_app_secret}`;
  await graph(`/${cfg.meta_app_id}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ object: "page", callback_url: `${origin}/api/meta/webhook`, fields: "leadgen", verify_token: cfg.meta_verify_token, access_token: appToken }),
  });
  const { error } = await supabaseAdmin().from("integrations").update({
    meta_page_id: page.id, meta_page_name: page.name, meta_page_token: page.access_token, meta_user_name: userName,
    meta_connected_at: new Date().toISOString(), meta_pages_pending: null,
  }).eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function disconnectMeta() {
  const cfg = await getIntegrations();
  if (cfg.meta_page_id && cfg.meta_page_token) {
    await graph(`/${cfg.meta_page_id}/subscribed_apps?access_token=${encodeURIComponent(cfg.meta_page_token)}`, { method: "DELETE" }).catch(() => {});
  }
  await supabaseAdmin().from("integrations").update({
    meta_page_id: null, meta_page_name: null, meta_page_token: null, meta_user_name: null, meta_connected_at: null, meta_pages_pending: null,
  }).eq("id", 1);
}

type Field = { name: string; values: string[] };
export function leadFromFields(fields: Field[]) {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const f = fields.find((x) => x.name.toLowerCase() === k || x.name.toLowerCase().includes(k));
      if (f?.values?.[0]) return f.values[0];
    }
    return "";
  };
  const name = pick("full_name", "name") || [pick("first_name"), pick("last_name")].filter(Boolean).join(" ") || "Meta lead";
  const extras = fields.filter((f) => !/name|phone|email|mobile/i.test(f.name)).map((f) => `${f.name.replace(/_/g, " ")}: ${f.values.join(", ")}`).join("\n");
  return { name, phone: pick("phone_number", "phone", "mobile", "whatsapp"), email: pick("email"), extras };
}

/** Pulls the last 7 days of leads from every form on the Page (duplicates are skipped by phone). */
export async function syncRecentLeads() {
  const cfg = await getIntegrations();
  if (!cfg.meta_page_id || !cfg.meta_page_token) throw new Error("Meta is not connected");
  const token = encodeURIComponent(cfg.meta_page_token);
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const forms = await graph<{ data: { id: string; name: string }[] }>(`/${cfg.meta_page_id}/leadgen_forms?fields=id,name&limit=50&access_token=${token}`);
  const admin = supabaseAdmin();
  let created = 0, duplicates = 0, invalid = 0;
  for (const form of forms.data ?? []) {
    const filtering = encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]));
    const leads = await graph<{ data: { id: string; field_data: Field[]; ad_name?: string; campaign_name?: string }[] }>(
      `/${form.id}/leads?fields=field_data,ad_name,campaign_name,created_time&limit=200&filtering=${filtering}&access_token=${token}`,
    );
    for (const l of leads.data ?? []) {
      const f = leadFromFields(l.field_data ?? []);
      const { data } = await admin.rpc("ingest_meta_lead", {
        p_name: f.name, p_phone: f.phone, p_email: f.email || null, p_campaign: l.campaign_name || form.name, p_ad_name: l.ad_name ?? null, p_note: f.extras || null,
      });
      if (data?.status === "created") created++; else if (data?.status === "duplicate") duplicates++; else invalid++;
    }
  }
  await admin.from("integrations").update({ meta_last_sync_at: new Date().toISOString() }).eq("id", 1);
  return { forms: forms.data?.length ?? 0, created, duplicates, invalid };
}
