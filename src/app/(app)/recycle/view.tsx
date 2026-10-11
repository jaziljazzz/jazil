"use client";

import { Recycle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActions } from "@/components/actions";
import { Button, Chip, EmptyState, PageHeader, Select, StageChip } from "@/components/ui";
import { SourceIcon } from "@/components/lead-card";
import { relative } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Lead, Profile } from "@/lib/types";

export function RecycleView({ pool, flagged, stale, team }: { pool: Lead[]; flagged: Lead[]; stale: Lead[]; team: Profile[] }) {
  const router = useRouter();
  const { toast, settings } = useActions();
  const [tab, setTab] = useState<"pool" | "flagged" | "stale">("pool");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const list = tab === "pool" ? pool : tab === "flagged" ? flagged : stale;
  const names = Object.fromEntries(team.map((t) => [t.id, t.name]));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function assign() {
    setBusy(true);
    const sb = supabaseBrowser();
    const ids = Array.from(sel);
    let error;
    if (to === "rr") ({ error } = await sb.rpc("recycle_round_robin", { p_leads: ids }));
    else for (const id of ids) { ({ error } = await sb.rpc("reassign_lead", { p_lead: id, p_owner: to, p_note: "From recycle pool" })); if (error) break; }
    setBusy(false);
    if (error) return toast(error.message, "error");
    toast(`${ids.length} lead(s) reassigned`);
    setSel(new Set());
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 md:px-8 md:py-8">
      <PageHeader title="Recycle pool" sub={`Leads with no activity for ${settings.recycle_days}+ days, untouched Instagram leads, and stale leads`} />
      <div className="flex flex-wrap gap-2">
        <Chip active={tab === "pool"} onClick={() => { setTab("pool"); setSel(new Set()); }} count={pool.length}>Recycle pool</Chip>
        <Chip active={tab === "flagged"} onClick={() => { setTab("flagged"); setSel(new Set()); }} count={flagged.length} tone={flagged.length ? "danger" : undefined}>Flagged untouched</Chip>
        <Chip active={tab === "stale"} onClick={() => { setTab("stale"); setSel(new Set()); }} count={stale.length}>Stale ({settings.stale_days}d)</Chip>
      </div>

      {list.length === 0 ? <EmptyState icon={<Recycle className="size-6" />} title="Nothing here" /> : (
        <>
          <div className="sticky top-12 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 md:top-0">
            <label className="flex items-center gap-2 px-2 text-[13px]">
              <input type="checkbox" className="size-4 accent-brand" checked={sel.size === list.length} onChange={(e) => setSel(e.target.checked ? new Set(list.map((l) => l.id)) : new Set())} />
              {sel.size} selected
            </label>
            <Select className="w-48" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Assign to…</option>
              <option value="rr">Round robin</option>
              {team.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}{t.on_leave ? " (leave)" : ""}</option>)}
            </Select>
            <Button size="sm" disabled={!sel.size || !to} loading={busy} onClick={assign}>Reassign</Button>
          </div>
          <div className="mt-2 divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-surface">
            {list.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-bg">
                <input type="checkbox" className="size-4 accent-brand" checked={sel.has(l.id)} onChange={() => toggle(l.id)} />
                <div className="min-w-0 flex-1">
                  <Link href={`/leads/${l.id}`} className="flex items-center gap-2 font-medium hover:text-brand" onClick={(e) => e.stopPropagation()}>{l.name} <SourceIcon source={l.source} /></Link>
                  <p className="text-[12px] text-muted">{names[l.owner_id ?? ""] ?? "Unassigned"} · last activity {relative(l.last_activity_at)}</p>
                </div>
                <StageChip stage={l.stage} />
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
