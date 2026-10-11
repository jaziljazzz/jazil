"use client";

import { Bell, Briefcase, CalendarCheck, Columns3, LayoutDashboard, LogOut, Plus, Recycle, Settings, Upload, User, Users, List } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { useActions } from "./actions";
import { Avatar, cn } from "./ui";

const MAIN = [
  { href: "/today", label: "My Day", icon: CalendarCheck },
  { href: "/leads", label: "Leads", icon: List },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
];
const SECONDARY = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/deals", label: "Deals", icon: Briefcase },
];
const FOUNDER = [
  { href: "/upload", label: "Upload leads", icon: Upload },
  { href: "/recycle", label: "Recycle pool", icon: Recycle },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function useUnread(userId: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sb = supabaseBrowser();
    const load = () =>
      sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)
        .then(({ count }: { count: number | null }) => setCount(count ?? 0));
    load();
    const ch = sb.channel(`notif-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    const t = setInterval(load, 60000);
    return () => {
      clearInterval(t);
      sb.removeChannel(ch);
    };
  }, [userId]);
  return count;
}

export function AppShell({ profile, children, companyName }: { profile: Profile; children: ReactNode; companyName: string }) {
  const path = usePathname();
  const { addLead } = useActions();
  const unread = useUnread(profile.id);
  const founder = profile.role === "founder";
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  const NavLink = ({ href, label, icon: Icon, badge }: { href: string; label: string; icon: typeof Bell; badge?: number }) => (
    <Link
      href={href}
      className={cn(
        "flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors",
        isActive(href) ? "bg-brand-50 font-medium text-brand" : "text-ink/80 hover:bg-black/5",
      )}
    >
      <Icon className="size-[18px]" />
      <span className="flex-1">{label}</span>
      {!!badge && <span className="tabular rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">{badge}</span>}
    </Link>
  );

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <div className="grid size-8 place-items-center rounded-lg bg-brand text-[13px] font-bold text-white">A</div>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold">{companyName}</div>
            <div className="text-[11px] text-muted">CRM</div>
          </div>
        </div>
        <div className="px-3 pb-2">
          <button onClick={addLead} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand text-[14px] font-medium text-white hover:bg-brand-600">
            <Plus className="size-4" /> Add lead
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {MAIN.map((n) => <NavLink key={n.href} {...n} />)}
          {SECONDARY.map((n) => <NavLink key={n.href} {...n} />)}
          <NavLink href="/notifications" label="Notifications" icon={Bell} badge={unread} />
          {founder && (
            <>
              <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Founder</div>
              {FOUNDER.map((n) => <NavLink key={n.href} {...n} />)}
            </>
          )}
        </nav>
        <div className="flex items-center gap-2.5 border-t border-line p-3">
          <Avatar name={profile.name} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium">{profile.name}</div>
            <div className="text-[11px] capitalize text-muted">{profile.role}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-black/5" title="Sign out"><LogOut className="size-4" /></button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-brand text-[12px] font-bold text-white">A</div>
          <span className="text-[14px] font-semibold">{companyName}</span>
        </div>
        <Link href="/notifications" className="relative grid size-10 place-items-center rounded-full" aria-label="Notifications">
          <Bell className="size-5" />
          {!!unread && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{unread}</span>}
        </Link>
      </header>

      <main className="min-w-0 flex-1 pb-28 md:pb-0">{children}</main>

      {/* Floating add button (phone) */}
      <button
        onClick={addLead}
        className="fixed bottom-[76px] right-4 z-30 grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 md:hidden"
        aria-label="Add lead"
      >
        <Plus className="size-6" />
      </button>

      {/* Bottom tab bar (phone) */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface md:hidden">
        {[...MAIN, { href: "/me", label: founder ? "Team" : "Me", icon: User }].map(({ href, label, icon: Icon }) => {
          const active = isActive(href) || (href === "/me" && [...SECONDARY, ...FOUNDER].some((s) => isActive(s.href)));
          return (
            <Link key={href} href={href} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px]", active ? "font-semibold text-brand" : "text-muted")}>
              <Icon className="size-[22px]" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
