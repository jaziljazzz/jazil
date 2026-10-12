import { headers } from "next/headers";
import { requireFounder } from "@/lib/session";
import { IntegrationsView } from "./view";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { supabase } = await requireFounder();
  const { data } = await supabase.from("integrations").select("*").eq("id", 1).single();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const mask = (v: string | null) => (v ? `••••${v.slice(-4)}` : "");
  return (
    <IntegrationsView
      origin={`${proto}://${host}`}
      initial={{
        meta_page_id: data?.meta_page_id ?? "",
        meta_page_token_set: mask(data?.meta_page_token ?? null),
        meta_app_secret_set: mask(data?.meta_app_secret ?? null),
        meta_verify_token: data?.meta_verify_token ?? "",
        wa_enabled: !!data?.wa_enabled,
        wa_token_set: mask(data?.wa_token ?? null),
        wa_phone_number_id: data?.wa_phone_number_id ?? "",
        wa_template_morning: data?.wa_template_morning ?? "",
        wa_template_evening: data?.wa_template_evening ?? "",
        wa_lang: data?.wa_lang ?? "en",
      }}
    />
  );
}
