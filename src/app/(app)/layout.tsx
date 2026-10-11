import { ActionsProvider } from "@/components/actions";
import { AppShell } from "@/components/app-shell";
import { getDevelopers, getSession, getSettings, getTeam } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSession();
  const [settings, developers, team] = await Promise.all([getSettings(), getDevelopers(), getTeam()]);
  return (
    <ActionsProvider profile={profile} settings={settings} developers={developers} team={team}>
      <AppShell profile={profile} companyName={settings.company_name}>{children}</AppShell>
    </ActionsProvider>
  );
}
