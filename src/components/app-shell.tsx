"use client";

import { ArrowLeft, Bell, Menu, Briefcase, CalendarCheck, Columns3, LayoutDashboard, LogOut, Plus, Recycle, Settings, Upload, Users, List } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

const TITLES: [string, string][] = [
  ["/today", "My Day"], ["/queue", "Calls"], ["/leads/", "Lead"], ["/leads", "Leads"], ["/pipeline", "Pipeline"],
  ["/deals", "Deals"], ["/dashboard", "Dashboard"], ["/upload", "Upload leads"], ["/recycle", "Recycle pool"],
  ["/team", "Team"], ["/settings", "Settings"], ["/notifications", "Notifications"], ["/me", "More"],
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
  const router = useRouter();
  const isTab = ["/today", "/leads", "/pipeline", "/me"].includes(path);
  const title = TITLES.find(([p]) => (p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(p + "/")))?.[1] ?? companyName;

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

      {/* Mobile app bar */}
      <header className="sticky top-0 z-30 bg-brand text-white shadow-sm md:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex h-14 items-center gap-1 px-2">
          {isTab ? (
            <div className="ml-2 grid size-8 shrink-0 place-items-center rounded-lg bg-white/15 text-[14px] font-bold">A</div>
          ) : (
            <button onClick={() => (history.length > 1 ? router.back() : router.push("/today"))} className="grid size-10 shrink-0 place-items-center rounded-full active:bg-white/15" aria-label="Back">
              <ArrowLeft className="size-[22px]" />
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate px-2 text-[18px] font-semibold">{title}</h1>
          <button onClick={addLead} className="grid size-10 place-items-center rounded-full active:bg-white/15" aria-label="Add lead">
            <Plus className="size-[22px]" />
          </button>
          <Link href="/notifications" className="relative grid size-10 place-items-center rounded-full active:bg-white/15" aria-label="Notifications">
            <Bell className="size-[22px]" />
            {!!unread && <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-brand">{unread > 99 ? "99+" : unread}</span>}
          </Link>
        </div>
      </header>

      <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>

      {/* Bottom tab bar (phone) */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        {[...MAIN, { href: "/me", label: "More", icon: Menu }].map(({ href, label, icon: Icon }) => {
          const active = isActive(href) || (href === "/me" && [...SECONDARY, ...FOUNDER].some((s) => isActive(s.href)));
          return (
            <Link key={href} href={href} className={cn("flex h-[60px] flex-col items-center justify-center gap-0.5 text-[11px]", active ? "font-semibold text-brand" : "text-muted")}>
              <span className={cn("grid h-7 w-14 place-items-center rounded-full transition-colors", active && "bg-brand-50")}>
                <Icon className="size-[21px]" />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
