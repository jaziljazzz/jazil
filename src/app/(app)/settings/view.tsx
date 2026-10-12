"use client";

import { ChevronRight, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { PushCard } from "@/components/push-toggle";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActions } from "@/components/actions";
import { Button, Card, ErrorText, Field, Input, PageHeader, SectionTitle } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { aed } from "@/lib/format";
import type { Developer, Settings } from "@/lib/types";

const RULES: { key: keyof Settings; label: string; unit: string; help: string }[] = [
  { key: "sla_minutes", label: "First call SLA", unit: "minutes", help: "Lead flagged red and agent notified" },
  { key: "reassign_hours", label: "Untouched company lead", unit: "hours", help: "Auto reassigned by round robin, founder notified" },
  { key: "max_attempts", label: "Unanswered attempts", unit: "attempts", help: "Lead moves to Lost (Unreachable)" },
  { key: "attempt_window_days", label: "…within", unit: "days", help: "Window for the unanswered attempts rule" },
  { key: "stale_days", label: "Stale lead", unit: "days", help: "No activity → flagged red on dashboards" },
  { key: "recycle_days", label: "Recycle pool", unit: "days", help: "No activity → moved to the recycle pool" },
  { key: "future_buyer_days", label: "Future buyer", unit: "days", help: "Lost as Future buyer reopens as Contacted" },
];

function ListEditor({ title, items, onSave }: { title: string; items: string[]; onSave: (v: string[]) => Promise<void> }) {
  const [list, setList] = useState(items);
  const [v, setV] = useState("");
  const dirty = JSON.stringify(list) !== JSON.stringify(items);
  return (
    <Card className="p-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {list.map((r) => (
          <span key={r} className="inline-flex h-8 items-center gap-1 rounded-full border border-line pl-3 pr-1 text-[13px]">
            {r}<button onClick={() => setList(list.filter((x) => x !== r))} className="grid size-6 place-items-center rounded-full text-muted hover:bg-black/5"><X className="size-3.5" /></button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add…" onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { setList([...list, v.trim()]); setV(""); } }} />
        <Button variant="secondary" onClick={() => { if (v.trim()) { setList([...list, v.trim()]); setV(""); } }}>Add</Button>
        {dirty && <Button onClick={() => onSave(list)}>Save</Button>}
      </div>
    </Card>
  );
}

export function SettingsView({ settings, developers, campaigns, welcome }: {
  settings: Settings; developers: Developer[]; campaigns: { id: string; name: string; cost: number | null }[]; welcome: boolean;
}) {
  const router = useRouter();
  const { toast } = useActions();
  const [s, setS] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dev, setDev] = useState({ name: "", default_commission_pct: "", contact_name: "", contact_phone: "" });
  const sb = supabaseBrowser();

  async function saveSettings(patch: Partial<Settings>) {
    setSaving(true);
    setError(null);
    const { error } = await sb.from("settings").update(patch).eq("id", 1);
    setSaving(false);
    if (error) setError(error.message); else { toast("Settings saved"); router.refresh(); }
  }
  async function addDev() {
    const { error } = await sb.from("developers").insert({ name: dev.name.trim(), default_commission_pct: Number(dev.default_commission_pct || 0), contact_name: dev.contact_name || null, contact_phone: dev.contact_phone || null });
    if (error) return toast(error.message, "error");
    setDev({ name: "", default_commission_pct: "", contact_name: "", contact_phone: "" });
    router.refresh();
  }
  async function updDev(id: string, patch: Partial<Developer>) {
    const { error } = await sb.from("developers").update(patch).eq("id", id);
    if (error) toast(error.message, "error"); else router.refresh();
  }
  async function delDev(id: string) {
    if (!confirm("Delete this developer?")) return;
    await sb.from("developers").delete().eq("id", id);
    router.refresh();
  }
  async function setCampaignCost(id: string, cost: string) {
    await sb.from("meta_campaigns").update({ cost: cost ? Number(cost) : null }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 md:px-8 md:py-8">
      <PageHeader title="Settings" sub="All time rules are applied automatically every 15 minutes" />
      {welcome && (
        <Card className="border-brand/30 bg-brand-50 p-4 text-[13px]">
          <p className="font-semibold text-brand">Welcome! Three steps to go live:</p>
          <ol className="mt-1 list-decimal pl-5 text-ink/80">
            <li>Add your developers and their default commission % below.</li>
            <li>Add your sales agents in <a className="font-medium text-brand" href="/team">Team</a>.</li>
            <li>Upload your first bought list in <a className="font-medium text-brand" href="/upload">Upload leads</a>.</li>
          </ol>
        </Card>
      )}

      <Card className="p-4">
        <SectionTitle>Company</SectionTitle>
        <div className="flex gap-2">
          <Input value={s.company_name} onChange={(e) => setS({ ...s, company_name: e.target.value })} />
          <Button variant="secondary" onClick={() => saveSettings({ company_name: s.company_name })}>Save</Button>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Time rules</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {RULES.map((r) => (
            <Field key={r.key} label={`${r.label} (${r.unit})`} hint={r.help}>
              <Input type="number" min={1} value={String(s[r.key])} onChange={(e) => setS({ ...s, [r.key]: Number(e.target.value) })} />
            </Field>
          ))}
          <Field label="Suggested follow up cadence (days)" hint="By attempt number: 1st, 2nd, 3rd…">
            <Input value={s.cadence_days.join(", ")} onChange={(e) => setS({ ...s, cadence_days: e.target.value.split(/[,\s]+/).map(Number).filter((n) => n > 0) })} />
          </Field>
        </div>
        <div className="mt-3"><ErrorText>{error}</ErrorText></div>
        <Button className="mt-3" loading={saving} onClick={() => saveSettings({
          sla_minutes: s.sla_minutes, reassign_hours: s.reassign_hours, max_attempts: s.max_attempts, attempt_window_days: s.attempt_window_days,
          stale_days: s.stale_days, recycle_days: s.recycle_days, future_buyer_days: s.future_buyer_days, cadence_days: s.cadence_days,
        })}>Save time rules</Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <ListEditor title="Lost reasons" items={settings.lost_reasons} onSave={(v) => saveSettings({ lost_reasons: v })} />
        <ListEditor title="Unit rejection reasons" items={settings.reject_reasons} onSave={(v) => saveSettings({ reject_reasons: v })} />
      </div>

      <Card className="p-4">
        <SectionTitle>Developers & default commission</SectionTitle>
        <div className="divide-y divide-line">
          {developers.map((d) => (
            <div key={d.id} className="grid grid-cols-[1fr_90px_auto] items-center gap-2 py-2 sm:grid-cols-[1fr_100px_1fr_1fr_auto]">
              <span className="font-medium">{d.name}</span>
              <div className="relative"><Input type="number" step="0.1" defaultValue={d.default_commission_pct} onBlur={(e) => Number(e.target.value) !== Number(d.default_commission_pct) && updDev(d.id, { default_commission_pct: Number(e.target.value) })} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span></div>
              <Input className="hidden sm:block" placeholder="Contact" defaultValue={d.contact_name ?? ""} onBlur={(e) => e.target.value !== (d.contact_name ?? "") && updDev(d.id, { contact_name: e.target.value || null })} />
              <Input className="hidden sm:block" placeholder="Phone" defaultValue={d.contact_phone ?? ""} onBlur={(e) => e.target.value !== (d.contact_phone ?? "") && updDev(d.id, { contact_phone: e.target.value || null })} />
              <button onClick={() => delDev(d.id)} className="grid size-9 place-items-center text-muted hover:text-danger"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_100px_1fr_1fr_auto]">
          <Input placeholder="Developer name" value={dev.name} onChange={(e) => setDev({ ...dev, name: e.target.value })} />
          <Input placeholder="%" inputMode="decimal" value={dev.default_commission_pct} onChange={(e) => setDev({ ...dev, default_commission_pct: e.target.value })} />
          <Input placeholder="Contact name" value={dev.contact_name} onChange={(e) => setDev({ ...dev, contact_name: e.target.value })} />
          <Input placeholder="Contact phone" value={dev.contact_phone} onChange={(e) => setDev({ ...dev, contact_phone: e.target.value })} />
          <Button disabled={!dev.name.trim()} onClick={addDev}><Plus className="size-4" /> Add</Button>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>WhatsApp quick messages</SectionTitle>
        <p className="mb-3 text-[12px] text-muted">Shown when an agent taps WhatsApp or swipes left. Use {"{name}"}, {"{agent}"} and {"{company}"} to fill in details.</p>
        <TemplatesEditor initial={settings.wa_templates ?? []} onSave={(v) => saveSettings({ wa_templates: v })} />
      </Card>

      <PushCard className="border border-line" />

      <Link href="/settings/integrations" className="flex items-center justify-between rounded-[12px] border border-line bg-surface p-4">
        <div>
          <p className="text-[15px] font-semibold">Integrations</p>
          <p className="text-[12px] text-muted">Meta Lead Ads, WhatsApp summaries</p>
        </div>
        <ChevronRight className="size-5 text-muted" />
      </Link>

      {campaigns.length > 0 && (
        <Card className="p-4">
          <SectionTitle>Meta campaign spend (for cost per deal)</SectionTitle>
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 border-t border-line py-2 text-[13px]">
              <span>{c.name}</span>
              <Input className="w-36" placeholder="AED spent" defaultValue={c.cost ?? ""} onBlur={(e) => setCampaignCost(c.id, e.target.value)} title={c.cost ? aed(c.cost) : ""} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function TemplatesEditor({ initial, onSave }: { initial: { title: string; body: string }[]; onSave: (v: { title: string; body: string }[]) => Promise<void> }) {
  const [list, setList] = useState(initial);
  const dirty = JSON.stringify(list) !== JSON.stringify(initial);
  const set = (i: number, k: "title" | "body", v: string) => setList(list.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  return (
    <div className="space-y-3">
      {list.map((t, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-line p-3">
          <div className="flex gap-2">
            <Input value={t.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="Title" />
            <button onClick={() => setList(list.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center text-muted hover:text-danger" aria-label="Remove"><Trash2 className="size-4" /></button>
          </div>
          <textarea rows={3} value={t.body} onChange={(e) => set(i, "body", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-brand" />
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setList([...list, { title: "New message", body: "Hi {name}, " }])}><Plus className="size-4" /> Add message</Button>
        {dirty && <Button onClick={() => onSave(list.filter((t) => t.title.trim() && t.body.trim()))}>Save messages</Button>}
      </div>
    </div>
  );
}
