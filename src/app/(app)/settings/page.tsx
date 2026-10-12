import { getDevelopers, getSettings, requireFounder } from "@/lib/session";
import { SettingsView } from "./view";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { supabase } = await requireFounder();
  const [settings, developers, { welcome }] = await Promise.all([getSettings(), getDevelopers(), searchParams]);
  const { data: campaigns } = await supabase.from("meta_campaigns").select("*").order("created_at", { ascending: false });
  return (
    <SettingsView
      settings={settings}
      developers={developers}
      campaigns={campaigns ?? []}
      welcome={!!welcome}
    />
  );
}
