import { requireFounder } from "@/lib/session";
import { getIntegrations } from "@/lib/server/integrations";
import { ConnectorsView } from "./view";

export const metadata = { title: "Connectors" };
export const dynamic = "force-dynamic";

export default async function ConnectorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireFounder();
  const sp = await searchParams;
  const cfg = await getIntegrations();
  return (
    <ConnectorsView
      flash={{ open: sp.open, error: sp.error, connected: !!sp.connected, pick: !!sp.pick }}
      meta={{
        appReady: !!(cfg.meta_app_id && cfg.meta_app_secret),
        appId: cfg.meta_app_id ?? "",
        configId: cfg.meta_login_config_id ?? "",
        secretSaved: !!cfg.meta_app_secret,
        connected: !!(cfg.meta_page_id && cfg.meta_page_token),
        pageName: cfg.meta_page_name, pageId: cfg.meta_page_id, userName: cfg.meta_user_name,
        connectedAt: cfg.meta_connected_at, lastSync: cfg.meta_last_sync_at,
        pending: (cfg.meta_pages_pending ?? []).map((p) => ({ id: p.id, name: p.name })),
      }}
      wa={{
        connected: !!(cfg.wa_enabled && cfg.wa_token && cfg.wa_phone_number_id),
        tokenSaved: !!cfg.wa_token, phoneNumberId: cfg.wa_phone_number_id ?? "", enabled: cfg.wa_enabled,
        morning: cfg.wa_template_morning ?? "", evening: cfg.wa_template_evening ?? "", lang: cfg.wa_lang,
      }}
    />
  );
}
