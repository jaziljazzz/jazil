import { headers } from "next/headers";
import { getDevelopers, getSettings, requireFounder } from "@/lib/session";
import { SettingsView } from "./view";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { supabase } = await requireFounder();
  const [settings, developers, { welcome }, h] = await Promise.all([getSettings(), getDevelopers(), searchParams, headers()]);
  const { data: campaigns } = await supabase.from("meta_campaigns").select("*").order("created_at", { ascending: false });
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return (
    <SettingsView
      settings={settings}
      developers={developers}
      campaigns={campaigns ?? []}
      welcome={!!welcome}
      meta={{
        webhookUrl: `${proto}://${host}/api/meta/webhook`,
        verifyToken: !!process.env.META_VERIFY_TOKEN,
        appSecret: !!process.env.META_APP_SECRET,
        pageToken: !!process.env.META_PAGE_ACCESS_TOKEN,
        serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }}
    />
  );
}
