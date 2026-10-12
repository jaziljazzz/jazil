import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface Integrations {
  meta_page_id: string | null;
  meta_page_token: string | null;
  meta_app_secret: string | null;
  meta_verify_token: string;
  wa_enabled: boolean;
  wa_token: string | null;
  wa_phone_number_id: string | null;
  wa_template_morning: string | null;
  wa_template_evening: string | null;
  wa_lang: string;
}

/** Credentials saved in Settings → Integrations, with environment variables as a fallback. */
export async function getIntegrations(): Promise<Integrations> {
  const { data } = await supabaseAdmin().from("integrations").select("*").eq("id", 1).single();
  const d = (data ?? {}) as Partial<Integrations>;
  return {
    meta_page_id: d.meta_page_id ?? null,
    meta_page_token: d.meta_page_token || process.env.META_PAGE_ACCESS_TOKEN || null,
    meta_app_secret: d.meta_app_secret || process.env.META_APP_SECRET || null,
    meta_verify_token: d.meta_verify_token || process.env.META_VERIFY_TOKEN || "",
    wa_enabled: !!d.wa_enabled,
    wa_token: d.wa_token ?? null,
    wa_phone_number_id: d.wa_phone_number_id ?? null,
    wa_template_morning: d.wa_template_morning ?? null,
    wa_template_evening: d.wa_template_evening ?? null,
    wa_lang: d.wa_lang || "en",
  };
}

const GRAPH = "https://graph.facebook.com/v21.0";

/** Sends an approved WhatsApp template with body parameters {{1}}, {{2}}, … */
export async function sendWaTemplate(cfg: Integrations, to: string, template: string, params: string[]) {
  const res = await fetch(`${GRAPH}/${cfg.wa_phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.wa_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/[^0-9]/g, ""),
      type: "template",
      template: {
        name: template,
        language: { code: cfg.wa_lang },
        components: params.length ? [{ type: "body", parameters: params.map((t) => ({ type: "text", text: t.replace(/\s+/g, " ").slice(0, 1000) })) }] : [],
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

export { GRAPH };
