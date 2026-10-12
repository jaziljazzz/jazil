"use client";

import {
  ArrowLeft, Bell, Briefcase, CalendarCheck, ChevronDown, ChevronRight, Columns3, LayoutDashboard, List, LogOut, Menu,
  Recycle, Search, Settings, SlidersHorizontal, Star, Upload, UserPlus, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { STAGES, STAGE_META } from "@/lib/constants";
import { supabaseBrowser } from "@/lib/supabase/client";
import { endOfDay } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { useActions } from "./actions";
import { Avatar, cn } from "./ui";

const TITLES: [string, string][] = [
  ["/today", "My Day"], ["/queue", "Calls"], ["/leads/", "Lead Details"], ["/leads", "Lead List"], ["/pipeline", "Pipeline"],
  ["/deals", "Deals"], ["/dashboard", "Dashboard"], ["/upload", "Upload Leads"], ["/recycle", "Recycle Pool"],
  ["/team", "Team"], ["/settings", "Settings"], ["/notifications", "Notifications"], ["/me", "Menu"],
];

const TABS = [
  { href: "/today", label: "My Day", icon: CalendarCheck },
  { href: "/leads", label: "Leads", icon: List },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const SMART_VIEWS: { key: string; label: string; dot: string }[] = [
  { key: "overdue", label: "Overdue Follow-Ups", dot: "#DC2626" },
  { key: "today", label: "Due Today", dot: "#D97706" },
  { key: "untouched", label: "New Untouched", dot: "#2563EB" },
  { key: "starred", label: "Starred Leads", dot: "#EAB308" },
  { key: "nofollowup", label: "No Follow-Up Set", dot: "#F59E0B" },
  { key: "stale", label: "Stale Leads", dot: "#EA580C" },
  { key: "sla", label: "First Call SLA Missed", dot: "#B91C1C" },
  ...STAGES.map((s) => ({ key: s, label: `${STAGE_META[s].label} Leads`, dot: STAGE_META[s].color })),
  { key: "open", label: "All Open Leads", dot: "#1E40AF" },
];

export function MobileNav({ profile, unread }: { profile: Profile; unread: number }) {
  const path = usePathname();
  const router = useRouter();
  const { addLead, starred } = useActions();
  const [drawer, setDrawer] = useState(false);
  const isTab = TABS.some((t) => t.href === path) || path === "/me";
  const title = TITLES.find(([p]) => (p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(p + "/")))?.[1] ?? "Aventus";
  const showFab = ["/today", "/leads", "/pipeline"].includes(path);

  useEffect(() => setDrawer(false), [path]);
  if (path === "/search") return null;

  return (
    <>
      {/* App bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface md:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex h-14 items-center gap-1 px-2">
          {isTab ? (
            <button onClick={() => setDrawer(true)} className="grid size-11 place-items-center rounded-full text-ink active:bg-black/5" aria-label="Menu">
              <Menu className="size-6" />
            </button>
          ) : (
            <button onClick={() => (history.length > 1 ? router.back() : router.push("/today"))} className="grid size-11 place-items-center rounded-full text-ink active:bg-black/5" aria-label="Back">
              <ArrowLeft className="size-6" />
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate px-2 text-[19px] font-medium text-ink">{title}</h1>
          <Link href="/search" className="grid size-11 place-items-center rounded-full text-ink active:bg-black/5" aria-label="Search">
            <Search className="size-[22px]" />
          </Link>
          {path === "/leads" ? (
            <button onClick={() => window.dispatchEvent(new Event("aventus:filters"))} className="grid size-11 place-items-center rounded-full text-ink active:bg-black/5" aria-label="Filters">
              <SlidersHorizontal className="size-[21px]" />
            </button>
          ) : (
            <Link href="/notifications" className="relative grid size-11 place-items-center rounded-full text-ink active:bg-black/5" aria-label="Notifications">
              <Bell className="size-[22px]" />
              {!!unread && <span className="absolute right-1.5 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-surface">{unread > 99 ? "99+" : unread}</span>}
            </Link>
          )}
        </div>
      </header>

      {/* Floating add lead */}
      {showFab && (
        <button
          onClick={addLead}
          className="fixed bottom-[76px] right-4 z-30 grid size-14 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30 active:scale-95 md:hidden"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Add lead"
        >
          <UserPlus className="size-6" />
        </button>
      )}

      {/* Bottom tabs */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface md:hidden">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link key={href} href={href} className={cn("flex h-[62px] flex-col items-center justify-center gap-1 text-[12px]", active ? "font-semibold text-brand" : "text-ink/70")}>
              <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {drawer && <Drawer profile={profile} unread={unread} starredCount={starred.size} onClose={() => setDrawer(false)} />}
    </>
  );
}

function Drawer({ profile, unread, starredCount, onClose }: { profile: Profile; unread: number; starredCount: number; onClose: () => void }) {
  const founder = profile.role === "founder";
  const [open, setOpen] = useState(true);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    // Founder sees company-wide counts; agents only their own (row level security).
    supabaseBrowser().rpc("lead_view_counts", { p_eod: endOfDay().toISOString() }).then(({ data }: { data: Record<string, number> | null }) => setCounts(data ?? {}));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const tiles = [
    { href: "/today", label: "My Day", icon: CalendarCheck },
    { href: "/leads", label: "Leads", icon: List },
    { href: "/pipeline", label: "Pipeline", icon: Columns3 },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/deals", label: "Deals", icon: Briefcase },
    ...(founder ? [
      { href: "/team", label: "Team", icon: Users },
      { href: "/upload", label: "Upload", icon: Upload },
      { href: "/recycle", label: "Recycle", icon: Recycle },
      { href: "/settings", label: "Settings", icon: Settings },
    ] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="animate-drawer absolute inset-y-0 left-0 flex w-[88%] max-w-[360px] flex-col bg-bg shadow-2xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-brand text-[14px] font-bold text-white">A</div>
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-wide text-brand">AVENTUS</div>
              <div className="text-[9px] font-semibold tracking-[0.3em] text-muted">REALTORS</div>
            </div>
          </div>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full active:bg-black/5" aria-label="Close menu"><X className="size-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <Avatar name={profile.name} className="size-11 text-[15px]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px]">Hi, <span className="font-semibold">{profile.name.split(" ")[0]}</span></p>
              <p className="truncate text-[12px] text-muted">{profile.email}</p>
            </div>
            {founder && (
              <Link href="/settings" className="grid size-10 place-items-center rounded-xl border border-line text-brand" aria-label="Settings"><Settings className="size-5" /></Link>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {tiles.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex aspect-[1.15] flex-col justify-between rounded-2xl bg-surface p-3 active:bg-brand-50">
                <span className="grid size-9 place-items-center self-end rounded-full bg-bg text-ink/60"><Icon className="size-[18px]" /></span>
                <span className="text-[13px] font-medium">{label}</span>
              </Link>
            ))}
          </div>

          <div className="mt-3 rounded-2xl bg-surface">
            <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3.5">
              <span className="flex items-center gap-2 text-[15px] font-medium text-brand"><Star className="size-[18px]" /> Smart views</span>
              <ChevronDown className={cn("size-5 text-brand transition-transform", !open && "-rotate-90")} />
            </button>
            {open && (
              <div className="border-t border-line pb-1">
                {SMART_VIEWS.map((v) => {
                  const n = v.key === "starred" ? starredCount : counts?.[v.key];
                  return (
                    <Link key={v.key} href={`/leads?view=${v.key}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-bg">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: v.dot }} />
                      <span className="flex-1 text-[14px]">{v.label}</span>
                      <span className="tabular text-[12px] text-muted">{n ?? ""}</span>
                      <ChevronRight className="size-4 text-muted" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 divide-y divide-line rounded-2xl bg-surface">
            <Link href="/notifications" className="flex items-center gap-3 px-4 py-3.5">
              <Bell className="size-5 text-ink/60" /><span className="flex-1 text-[14px]">Notifications</span>
              {!!unread && <span className="tabular rounded-full border border-line px-2 text-[12px]">{unread}</span>}
              <ChevronRight className="size-4 text-muted" />
            </Link>
            <form action="/auth/signout" method="post">
              <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-danger">
                <LogOut className="size-5" /><span className="flex-1 text-[14px]">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
}
