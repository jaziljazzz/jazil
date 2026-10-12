import { ActionsProvider } from "@/components/actions";
import { AppShell } from "@/components/app-shell";
import { getDevelopers, getSession, getSettings, getTeam } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // One parallel round of queries for the shell.
  const [{ profile }, settings, developers, team] = await Promise.all([getSession(), getSettings(), getDevelopers(), getTeam()]);
  return (
    <ActionsProvider profile={profile} settings={settings} developers={developers} team={team}>
      <AppShell profile={profile} companyName={settings.company_name}>{children}</AppShell>
    </ActionsProvider>
  );
}
