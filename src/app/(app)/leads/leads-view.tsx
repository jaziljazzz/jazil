"use client";

import { Download, Search, SlidersHorizontal, Users } from "lucide-react";
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

      <div className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="hidden text-[20px] font-semibold md:block">Leads</h1>
          <p className="text-[13px] text-muted md:hidden">{views.find((v) => v.key === current)?.label} · {total}</p>
          <div className="flex items-center gap-2">
            {isFounder && <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> <span className="hidden sm:inline">Export</span></Button>}
            <Button variant="secondary" size="sm" onClick={() => setShowFilters((s) => !s)}><SlidersHorizontal className="size-4" /> <span className="hidden sm:inline">Filters</span></Button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input id="lead-search" className="pl-9" placeholder="Search name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {/* Smart views (phone/tablet) */}
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 lg:hidden">
          {views.map((v) => (
            <Link key={v.key} href={href({ view: v.key, page: undefined })}>
              <Chip active={current === v.key} tone={v.count ? v.tone : undefined} count={v.count}>{v.label}</Chip>
            </Link>
          ))}
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-3 md:grid-cols-4">
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

        <p className="mt-3 hidden text-[12px] text-muted md:block">{total} lead{total === 1 ? "" : "s"}</p>

        {leads.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title="No leads in this view" />
        ) : (
          <>
            {/* Phone: cards */}
            <LeadList className="mt-2 md:hidden">
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
