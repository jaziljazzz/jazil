"use client";

import { Download, Search, SlidersHorizontal, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActions } from "@/components/actions";
import { budgetLabel, DueText, LeadCard, LeadList, SourceIcon } from "@/components/lead-card";
import { Badge, Button, Chip, cn, EmptyState, Input, Select, StageChip } from "@/components/ui";
import { SOURCE_META } from "@/lib/constants";
import { relative } from "@/lib/format";
import type { Lead, Profile } from "@/lib/types";

type View = { key: string; label: string; count: number; tone?: "danger" | "warning" | "info" };

export function LeadsView({ leads, total, page, pageSize, views, current, params, team, owners, meId }: {
  leads: Lead[]; total: number; page: number; pageSize: number; views: View[]; current: string;
  params: Record<string, string | undefined>; team: Profile[]; owners: Record<string, string>; meId: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const { isFounder } = useActions();
  const [q, setQ] = useState(params.q ?? "");
  const [showFilters, setShowFilters] = useState(!!(params.source || params.agent || params.from));
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const open = () => setSheet(true);
    window.addEventListener("aventus:filters", open);
    return () => window.removeEventListener("aventus:filters", open);
  }, []);

  const href = (patch: Record<string, string | undefined>) => {
    const next = { ...params, ...patch };
    const usp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && usp.set(k, v));
    return `${path}?${usp}`;
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.q ?? "") !== q) router.replace(href({ q: q || undefined, page: undefined, preview: undefined }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Keyboard shortcuts on desktop: "/" focuses search, j/k move preview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/") { e.preventDefault(); document.getElementById("lead-search")?.focus(); }
      if (e.key === "j" || e.key === "k") {
        const idx = leads.findIndex((l) => l.id === params.preview);
        const n = leads[Math.max(0, Math.min(leads.length - 1, idx + (e.key === "j" ? 1 : -1)))];
        if (n) router.replace(href({ preview: n.id }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function exportCsv() {
    const rows = [["Name", "Phone", "Stage", "Source", "Campaign", "Owner", "Next follow up", "Last activity", "Created"]];
    leads.forEach((l) => rows.push([l.name, l.phone, l.stage, l.source, l.campaign ?? "", owners[l.owner_id ?? ""] ?? "", l.next_followup_at ?? "", l.last_activity_at, l.created_at]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `aventus-leads-${current}.csv`;
    a.click();
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-w-0 flex-1 md:flex">
      {/* Smart views (desktop) */}
      <nav className="sticky top-0 hidden h-dvh w-52 shrink-0 overflow-y-auto border-r border-line bg-surface px-2 py-4 lg:block">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Smart views</p>
        {views.map((v) => (
          <Link key={v.key} href={href({ view: v.key, page: undefined, preview: undefined })}
            className={cn("flex h-8 items-center justify-between rounded-lg px-2 text-[13px]", current === v.key ? "bg-brand-50 font-medium text-brand" : "hover:bg-black/5")}>
            <span>{v.label}</span>
            <span className={cn("tabular text-[12px]", v.count && v.tone === "danger" ? "font-semibold text-danger" : v.count && v.tone === "warning" ? "text-warning" : "text-muted")}>{v.count}</span>
          </Link>
        ))}
      </nav>

      <div className="min-w-0 flex-1 px-3 py-3 md:px-6 md:py-6">
        <div className="mb-3 hidden items-center justify-between gap-3 md:flex">
          <h1 className="text-[20px] font-semibold">Leads</h1>
          <div className="flex items-center gap-2">
            {isFounder && <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> Export</Button>}
            <Button variant="secondary" size="sm" onClick={() => setShowFilters((s) => !s)}><SlidersHorizontal className="size-4" /> Filters</Button>
          </div>
        </div>

        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input id="lead-search" className="pl-9" placeholder="Search name, phone or email  ( / )" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {/* Phone: All / Starred like LeadSquared */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {([["all", "All"], ["starred", "Starred"]] as const).map(([k, label]) => {
            const active = k === "starred" ? current === "starred" : current !== "starred";
            return (
              <Link key={k} href={href({ view: k === "starred" ? "starred" : undefined, page: undefined })}
                className={cn("grid h-12 place-items-center rounded-xl text-[15px] font-medium transition-colors", active ? "bg-brand text-white shadow-sm" : "bg-brand-50 text-brand")}>
                {label}
              </Link>
            );
          })}
        </div>
        {(() => {
          const v = views.find((x) => x.key === current);
          const filtered = !!(params.source || params.agent || params.from || params.q);
          return (
            <div className="mt-3 flex items-center justify-between gap-2 px-1 md:hidden">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {current !== "open" && current !== "starred" && v && (
                  <Link href={href({ view: undefined, page: undefined })} className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-50 px-2.5 text-[12px] font-medium text-brand">
                    {v.label} <X className="size-3.5" />
                  </Link>
                )}
                {filtered && (
                  <Link href={href({ source: undefined, agent: undefined, from: undefined, to: undefined, q: undefined, page: undefined })} className="inline-flex h-7 items-center gap-1 rounded-full bg-warning-50 px-2.5 text-[12px] font-medium text-warning">
                    Filtered <X className="size-3.5" />
                  </Link>
                )}
                <span className="text-[13px] text-muted">{total} lead{total === 1 ? "" : "s"}</span>
              </div>
              <button onClick={() => setSheet(true)} className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand">
                <SlidersHorizontal className="size-4" /> Sort & filter
              </button>
            </div>
          );
        })()}

        {/* Smart views (tablet) */}
        <div className="no-scrollbar -mx-4 mt-3 hidden gap-2 overflow-x-auto px-4 md:flex lg:hidden">
          {views.map((v) => (
            <Link key={v.key} href={href({ view: v.key, page: undefined })}>
              <Chip active={current === v.key} tone={v.count ? v.tone : undefined} count={v.count}>{v.label}</Chip>
            </Link>
          ))}
        </div>

        {showFilters && (
          <div className="mt-3 hidden grid-cols-4 gap-2 rounded-xl border border-line bg-surface p-3 md:grid">
            <Select value={params.source ?? ""} onChange={(e) => router.replace(href({ source: e.target.value || undefined, page: undefined }))}>
              <option value="">All sources</option>
              {Object.entries(SOURCE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            {isFounder && (
              <Select value={params.agent ?? ""} onChange={(e) => router.replace(href({ agent: e.target.value || undefined, page: undefined }))}>
                <option value="">All agents</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            )}
            <Input type="date" value={params.from ?? ""} onChange={(e) => router.replace(href({ from: e.target.value || undefined, page: undefined }))} aria-label="Created from" />
            <Input type="date" value={params.to ?? ""} onChange={(e) => router.replace(href({ to: e.target.value || undefined, page: undefined }))} aria-label="Created to" />
          </div>
        )}
        {sheet && <SortFilter params={params} views={views} team={isFounder ? team : []} onClose={() => setSheet(false)} onApply={(patch) => { setSheet(false); router.replace(href({ ...patch, page: undefined, preview: undefined })); }} />}

        <p className="mt-3 hidden text-[12px] text-muted md:block">{total} lead{total === 1 ? "" : "s"}</p>

        {leads.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title="No leads in this view" />
        ) : (
          <>
            {/* Phone: cards */}
            <LeadList className="mt-3 md:hidden">
              {leads.map((l) => <LeadCard key={l.id} lead={l} ownerName={isFounder && l.owner_id !== meId ? owners[l.owner_id ?? ""] : undefined} />)}
            </LeadList>
            {/* Desktop: dense table, row opens the preview panel */}
            <div className="mt-2 hidden overflow-hidden rounded-[12px] border border-line bg-surface md:block">
              <table className="w-full text-[13px]">
                <thead className="border-b border-line bg-bg/60 text-left text-[12px] text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium">Next follow up</th>
                    <th className="hidden px-3 py-2 font-medium xl:table-cell">Budget</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    {isFounder && <th className="px-3 py-2 font-medium">Owner</th>}
                    <th className="px-3 py-2 font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}
                      onClick={(e) => { if (e.metaKey || e.ctrlKey) window.open(`/leads/${l.id}`); else if (window.innerWidth >= 1280) router.replace(href({ preview: l.id })); else router.push(`/leads/${l.id}`); }}
                      onDoubleClick={() => router.push(`/leads/${l.id}`)}
                      className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-bg", params.preview === l.id && "bg-brand-50/60")}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 font-medium">
                          {l.name}
                          {l.sla_breached && <Badge tone="danger">SLA</Badge>}
                          {l.is_stale && <Badge tone="warning">Stale</Badge>}
                        </div>
                        <div className="tabular text-[12px] text-muted">{l.phone}</div>
                      </td>
                      <td className="px-3 py-2.5"><StageChip stage={l.stage} /></td>
                      <td className="px-3 py-2.5"><DueText lead={l} /></td>
                      <td className="hidden px-3 py-2.5 text-muted xl:table-cell">{budgetLabel(l.requirements) ?? "—"}</td>
                      <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5 text-muted"><SourceIcon source={l.source} />{l.source === "meta" && l.campaign ? l.campaign : SOURCE_META[l.source].short}</span></td>
                      {isFounder && <td className="px-3 py-2.5">{owners[l.owner_id ?? ""] ?? "—"}</td>}
                      <td className="px-3 py-2.5 text-muted">{relative(l.last_activity_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {page > 1 && <Link href={href({ page: String(page - 1) })}><Button variant="secondary" size="sm">Previous</Button></Link>}
                <span className="tabular text-[13px] text-muted">Page {page} of {pages}</span>
                {page < pages && <Link href={href({ page: String(page + 1) })}><Button variant="secondary" size="sm">Next</Button></Link>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── Sort and Filter (full screen, LeadSquared style) ─────────────────────────────
const SORT_OPTIONS = [
  ["followup", "Next follow-up (soonest first)"],
  ["newest", "Newest leads"],
  ["activity", "Recently active"],
  ["name", "Name (A–Z)"],
] as const;

function SortFilter({ params, views, team, onClose, onApply }: {
  params: Record<string, string | undefined>; views: View[]; team: Profile[];
  onClose: () => void; onApply: (patch: Record<string, string | undefined>) => void;
}) {
  const [cat, setCat] = useState("sort");
  const [f, setF] = useState({
    sort: params.sort ?? "followup", view: params.view ?? "open", source: params.source ?? "", agent: params.agent ?? "", from: params.from ?? "", to: params.to ?? "",
  });
  const cats = [
    ["sort", "Sort by"], ["view", "Lead Stage"], ["source", "Lead Source"], ...(team.length ? [["agent", "Owner"]] : []), ["date", "Created Date"],
  ] as [string, string][];
  const Radio = ({ on, label, sub, onClick }: { on: boolean; label: string; sub?: string | number; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-line px-4 py-4 text-left active:bg-bg">
      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", on ? "border-brand" : "border-brand/50")}>
        {on && <span className="size-2.5 rounded-full bg-brand" />}
      </span>
      <span className={cn("flex-1 text-[15px]", on ? "font-medium text-ink" : "text-ink/75")}>{label}</span>
      {sub !== undefined && <span className="tabular text-[13px] text-muted">{sub}</span>}
    </button>
  );
  const isSet = (k: string) => (k === "sort" ? f.sort !== "followup" : k === "view" ? f.view !== "open" : k === "date" ? !!(f.from || f.to) : !!f[k as "source" | "agent"]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface md:hidden" role="dialog" aria-modal="true" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-3">
        <button onClick={onClose} className="grid size-11 place-items-center rounded-full active:bg-black/5" aria-label="Close"><X className="size-6" /></button>
        <h2 className="text-[19px] font-medium">Sort and Filter</h2>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-[38%] shrink-0 overflow-y-auto border-r border-line bg-bg">
          {cats.map(([k, label]) => (
            <button key={k} onClick={() => setCat(k)}
              className={cn("relative flex w-full items-center justify-between border-b border-line px-4 py-5 text-left text-[15px]", cat === k ? "bg-surface font-medium text-brand" : "text-ink/80")}>
              {label}
              {isSet(k) && <span className="size-2 rounded-full bg-brand" />}
              {cat === k && <span className="absolute inset-y-2 right-0 w-1 rounded-l bg-brand" />}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto">
          {cat === "sort" && SORT_OPTIONS.map(([k, label]) => <Radio key={k} on={f.sort === k} label={label} onClick={() => setF({ ...f, sort: k })} />)}
          {cat === "view" && views.map((v) => <Radio key={v.key} on={f.view === v.key} label={v.label} sub={v.count} onClick={() => setF({ ...f, view: v.key })} />)}
          {cat === "source" && ([["", "All sources"], ...Object.entries(SOURCE_META).map(([k, v]) => [k, v.label])] as [string, string][]).map(([k, label]) => (
            <Radio key={k} on={f.source === k} label={label} onClick={() => setF({ ...f, source: k })} />
          ))}
          {cat === "agent" && ([["", "All owners"], ...team.filter((t) => t.active).map((t) => [t.id, t.name])] as [string, string][]).map(([k, label]) => (
            <Radio key={k} on={f.agent === k} label={label} onClick={() => setF({ ...f, agent: k })} />
          ))}
          {cat === "date" && (
            <div className="space-y-4 p-4">
              <label className="block space-y-1.5"><span className="text-[13px] text-muted">From</span><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
              <label className="block space-y-1.5"><span className="text-[13px] text-muted">To</span><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
            </div>
          )}
        </div>
      </div>
      <div className="safe-bottom flex shrink-0 gap-3 border-t border-line px-4 py-3">
        <Button variant="secondary" size="lg" className="w-28" onClick={() => setF({ sort: "followup", view: "open", source: "", agent: "", from: "", to: "" })}>Reset</Button>
        <Button size="lg" className="flex-1" onClick={() => onApply({
          sort: f.sort === "followup" ? undefined : f.sort, view: f.view === "open" ? undefined : f.view,
          source: f.source || undefined, agent: f.agent || undefined, from: f.from || undefined, to: f.to || undefined,
        })}>Apply</Button>
      </div>
    </div>
  );
}
