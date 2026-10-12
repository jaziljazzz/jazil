"use client";

import { AlertTriangle, ArrowLeft, CalendarPlus, Handshake, MessageCircle, Phone, PhoneCall, StickyNote, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActions } from "@/components/actions";
import { StagePath } from "@/components/stage-path";
import { RequirementFields } from "@/components/stage-fields";
import { Timeline } from "@/components/timeline";
import { Badge, Button, Card, Chip, cn, ErrorText, Field, Input, Select, StageChip } from "@/components/ui";
import { LeadAvatar } from "@/components/lead-card";
import { MEETING_LABEL, SOURCE_META } from "@/lib/constants";
import { aed, dueInfo, errMsg, fmtDate, fmtDateTime, relative } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Activity, Deal, Feedback, Lead, Meeting, Requirement, ShortlistedUnit } from "@/lib/types";

type Tab = "timeline" | "requirement" | "shortlist" | "details";

export function LeadDetail({ lead, requirement, units, activities, meetings, deals }: {
  lead: Lead & { batch?: { name: string } | null }; requirement: Requirement | null; units: ShortlistedUnit[];
  activities: Activity[]; meetings: Meeting[]; deals: Deal[];
}) {
  const a = useActions();
  const [tab, setTab] = useState<Tab>("timeline");
  const due = dueInfo(lead.next_followup_at);
  const open = lead.stage !== "won" && lead.stage !== "lost";
  const untouched = lead.stage === "new" && !lead.first_called_at && !lead.next_followup_at;

  const header = (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <LeadAvatar name={lead.name} className="size-12 text-[16px]" />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-[19px] font-semibold leading-snug">{lead.name}</h1>
          <a href={`tel:${lead.phone}`} onClick={(e) => { e.preventDefault(); a.call(lead); }} className="tabular mt-0.5 block text-[14px] font-medium text-brand">{lead.phone}</a>
          <div className="mt-1.5"><StageChip stage={lead.stage} /></div>
        </div>
      </div>
      <p className="mt-3 break-words text-[12px] text-muted">
        {SOURCE_META[lead.source].label}
        {lead.campaign ? ` · ${lead.campaign}` : ""}
        {lead.batch?.name ? ` · ${lead.batch.name}` : ""}
        {lead.owner?.name ? ` · Owner: ${lead.owner.name}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {lead.sla_breached && <Badge tone="danger">First call SLA missed</Badge>}
        {lead.is_stale && <Badge tone="warning">Stale</Badge>}
        {lead.in_recycle_pool && <Badge tone="warning">Recycle pool</Badge>}
        {lead.lost_reason && <Badge tone="danger">{lead.lost_reason}</Badge>}
      </div>
      {open && (
        <button
          onClick={() => (untouched ? a.logCall(lead) : a.reschedule(lead))}
          className={cn(
            "mt-3 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13px] font-medium",
            untouched ? "border-info/30 bg-info-50 text-info" :
            due.tone === "overdue" ? "border-danger/30 bg-danger-50 text-danger" :
            due.tone === "today" ? "border-warning/30 bg-warning-50 text-warning" :
            due.tone === "none" ? "border-warning/30 bg-warning-50 text-warning" : "border-line bg-bg text-ink",
          )}
        >
          <span className="flex items-center gap-2">
            {due.tone === "none" && !untouched && <AlertTriangle className="size-4" />}
            {untouched ? "Not called yet — call now" : `Follow up: ${due.label}`}
          </span>
          <span className="text-[12px] font-normal opacity-80">{untouched ? "" : "Change"}</span>
        </button>
      )}
    </Card>
  );

  const actions = (
    <div className="grid grid-cols-5 gap-2">
      {[
        { label: "Call", icon: Phone, onClick: () => a.call(lead), cls: "text-success" },
        { label: "WhatsApp", icon: MessageCircle, onClick: () => a.whatsapp(lead), cls: "text-[#25D366]" },
        { label: "Log call", icon: PhoneCall, onClick: () => a.logCall(lead), cls: "text-brand" },
        { label: "Note", icon: StickyNote, onClick: () => a.addNote(lead), cls: "text-ink" },
        { label: "Meeting", icon: CalendarPlus, onClick: () => a.scheduleMeeting(lead), cls: "text-[#C026D3]" },
      ].map((b) => (
        <button key={b.label} onClick={b.onClick} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1 text-[11px] whitespace-nowrap text-ink/70 active:bg-black/5">
          <span className={cn("grid size-12 place-items-center rounded-full border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]", b.cls)}><b.icon className="size-5" /></span>
          {b.label}
        </button>
      ))}
    </div>
  );

  const composer = (
    <div className="mb-4 flex gap-2">
      <button onClick={() => a.logCall(lead)} className="h-11 min-w-0 flex-1 truncate rounded-lg border border-line bg-bg px-3 text-left text-[13px] text-muted hover:border-brand/40 md:h-10">Log a call, note or meeting…</button>
      <Chip onClick={() => a.logCall(lead)} className="hidden md:inline-flex">Call</Chip>
      <Chip onClick={() => a.addNote(lead)} className="hidden md:inline-flex">Note</Chip>
      <Chip onClick={() => a.scheduleMeeting(lead)} className="hidden md:inline-flex">Meeting</Chip>
    </div>
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "timeline", label: "Timeline" },
    { key: "requirement", label: "Requirement" },
    { key: "shortlist", label: `Shortlist${units.length ? ` (${units.length})` : ""}` },
    { key: "details", label: "Details" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 pb-20 pt-3 md:px-6 md:py-6">
      <button onClick={() => history.length > 1 ? history.back() : null} className="mb-3 hidden items-center gap-1 text-[13px] text-muted md:flex">
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        {/* Left: header + actions */}
        <div className="min-w-0 space-y-3 md:space-y-4">
          {header}
          {actions}
          {open && (lead.stage === "meeting" || lead.stage === "negotiation") && (
            <Button variant="success" className="w-full" onClick={() => a.markWon(lead)}><Handshake className="size-4" /> Mark Won</Button>
          )}
          <div className="hidden xl:hidden lg:block"><SidePanel lead={lead} meetings={meetings} deals={deals} /></div>
        </div>

        {/* Middle: stage path + tabs */}
        <div className="min-w-0 space-y-3 md:space-y-4">
          <Card className="p-4 md:p-3"><StagePath stage={lead.stage} onPick={(s) => a.changeStage(lead, s)} disabled={lead.stage === "won" && !a.isFounder} /></Card>
          <Card>
            <div className="no-scrollbar flex overflow-x-auto border-b border-line px-1">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={cn("h-12 flex-1 shrink-0 whitespace-nowrap border-b-2 px-2.5 text-[13px] font-medium md:px-3", tab === t.key ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink")}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {tab === "timeline" && <>{composer}<Timeline activities={activities} /></>}
              {tab === "requirement" && <RequirementTab lead={lead} requirement={requirement} />}
              {tab === "shortlist" && <ShortlistTab lead={lead} units={units} />}
              {tab === "details" && (
                <>
                  <div className="mb-5 lg:hidden"><SidePanel lead={lead} meetings={meetings} deals={deals} /></div>
                  <DetailsTab lead={lead} meetings={meetings} deals={deals} />
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Right: next follow up, meetings, deal (desktop) */}
        <div className="hidden xl:block"><SidePanel lead={lead} meetings={meetings} deals={deals} /></div>
      </div>

      {/* Phone: primary action pinned in thumb reach, above the tab bar */}
      <div className="fixed inset-x-0 bottom-[62px] z-20 border-t border-line bg-surface/95 px-3 py-2 backdrop-blur md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" onClick={() => a.logCall(lead)}><PhoneCall className="size-4" /> Log call</Button>
          {open && <Button variant="secondary" size="lg" className="shrink-0" onClick={() => a.reschedule(lead)}>Reschedule</Button>}
        </div>
      </div>
    </div>
  );
}

function SidePanel({ lead, meetings, deals }: { lead: Lead; meetings: Meeting[]; deals: Deal[] }) {
  const router = useRouter();
  const upcoming = meetings.filter((m) => m.status === "scheduled");
  const deal = deals.find((d) => !d.cancelled);
  async function setMeeting(id: string, status: "done" | "no_show") {
    const feedback = status === "done" ? prompt("Meeting feedback (optional)") ?? "" : "";
    await supabaseBrowser().rpc("update_meeting", { p_meeting: id, p_status: status, p_feedback: feedback });
    router.refresh();
  }
  return (
    <div className="space-y-4">
      {deal && (
        <Card className="p-4">
          <p className="text-[12px] font-medium text-muted">Deal</p>
          <p className="mt-1 text-[15px] font-semibold">{deal.project} {deal.unit}</p>
          <p className="tabular text-[13px]">{aed(deal.sale_value)} · {deal.commission_pct}%</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="tabular text-[15px] font-semibold text-success">{aed(deal.commission_amount)}</span>
            <Badge tone={deal.commission_status === "received" ? "success" : "warning"}>{deal.commission_status === "received" ? "Received" : "Pending"}</Badge>
          </div>
          <Link href="/deals" className="mt-2 block text-[12px] font-medium text-brand">Open in Deals →</Link>
        </Card>
      )}
      <Card className="p-4">
        <p className="text-[12px] font-medium text-muted">Meetings</p>
        {meetings.length === 0 && <p className="mt-1 text-[13px] text-muted">None yet</p>}
        <div className="mt-2 space-y-2">
          {meetings.map((m) => (
            <div key={m.id} className="rounded-lg border border-line p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">{MEETING_LABEL[m.type]}</span>
                <Badge tone={m.status === "done" ? "success" : m.status === "no_show" ? "danger" : "info"}>{m.status.replace("_", " ")}</Badge>
              </div>
              <p className="text-[12px] text-muted">{fmtDateTime(m.scheduled_at)}{m.location ? ` · ${m.location}` : ""}</p>
              {m.feedback && <p className="mt-1 text-[12px]">{m.feedback}</p>}
              {m.status === "scheduled" && upcoming.includes(m) && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setMeeting(m.id, "done")}>Done</Button>
                  <Button size="sm" variant="ghost" onClick={() => setMeeting(m.id, "no_show")}>No show</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4 text-[13px]">
        <div className="grid grid-cols-2 gap-y-2">
          <span className="text-muted">Attempts</span><span className="tabular text-right">{lead.attempt_count}</span>
          <span className="text-muted">Assigned</span><span className="text-right">{relative(lead.assigned_at)}</span>
          <span className="text-muted">First call</span><span className="text-right">{lead.first_called_at ? relative(lead.first_called_at) : "—"}</span>
          <span className="text-muted">Last activity</span><span className="text-right">{relative(lead.last_activity_at)}</span>
          <span className="text-muted">Created</span><span className="text-right">{fmtDate(lead.created_at, { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </Card>
    </div>
  );
}

function RequirementTab({ lead, requirement }: { lead: Lead; requirement: Requirement | null }) {
  const router = useRouter();
  const { toast } = useActions();
  const [req, setReq] = useState<Partial<Requirement> & { nationality?: string; is_nri?: boolean }>({
    ...(requirement ?? {}), nationality: lead.nationality ?? "", is_nri: lead.is_nri,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setSaving(true);
    setError(null);
    try {
      const sb = supabaseBrowser();
      const { nationality, is_nri, id: _id, ...r } = req as Requirement & { nationality?: string; is_nri?: boolean; created_at?: string; updated_at?: string };
      delete (r as Record<string, unknown>).created_at;
      delete (r as Record<string, unknown>).updated_at;
      const { error } = await sb.from("requirements").upsert({ ...r, lead_id: lead.id }, { onConflict: "lead_id" });
      if (error) throw error;
      await sb.from("leads").update({ nationality: nationality || null, is_nri: !!is_nri }).eq("id", lead.id);
      toast("Requirement saved");
      router.refresh();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  }
  return (
    <div className="space-y-4">
      <RequirementFields value={req} onChange={setReq} />
      <Field label="Notes"><Input value={req.notes ?? ""} onChange={(e) => setReq({ ...req, notes: e.target.value })} placeholder="Views, floor, parking…" /></Field>
      <ErrorText>{error}</ErrorText>
      <Button onClick={save} loading={saving}>Save requirement</Button>
    </div>
  );
}

function ShortlistTab({ lead, units }: { lead: Lead; units: ShortlistedUnit[] }) {
  const router = useRouter();
  const { developers, settings, toast } = useActions();
  const [u, setU] = useState({ project: "", developer_id: "", unit_type: "", price: "" });
  const [saving, setSaving] = useState(false);
  const devName = Object.fromEntries(developers.map((d) => [d.id, d.name]));

  async function add() {
    setSaving(true);
    const { error } = await supabaseBrowser().from("shortlisted_units").insert({
      lead_id: lead.id, project: u.project.trim(), developer_id: u.developer_id || null, unit_type: u.unit_type || null, price: u.price ? Number(u.price) : null,
    });
    setSaving(false);
    if (error) return toast(error.message, "error");
    setU({ project: "", developer_id: "", unit_type: "", price: "" });
    router.refresh();
  }
  async function feedback(id: string, fb: Feedback, reason?: string) {
    await supabaseBrowser().from("shortlisted_units").update({ feedback: fb, reject_reason: fb === "rejected" ? reason ?? null : null }).eq("id", id);
    router.refresh();
  }
  async function remove(id: string) {
    await supabaseBrowser().from("shortlisted_units").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {units.length === 0 && <p className="text-[13px] text-muted">No units shortlisted yet.</p>}
      <div className="space-y-2">
        {units.map((x) => (
          <div key={x.id} className="rounded-xl border border-line p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[14px] font-semibold">{x.project}</p>
                <p className="text-[12px] text-muted">{[x.developer_id && devName[x.developer_id], x.unit_type, x.price && aed(x.price)].filter(Boolean).join(" · ")}</p>
              </div>
              <button onClick={() => remove(x.id)} className="text-muted hover:text-danger" aria-label="Remove"><Trash2 className="size-4" /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip className="h-7 text-[12px]" active={x.feedback === "liked"} onClick={() => feedback(x.id, "liked")}>Liked</Chip>
              <Chip className="h-7 text-[12px]" active={x.feedback === "maybe"} onClick={() => feedback(x.id, "maybe")}>Maybe</Chip>
              <Chip className="h-7 text-[12px]" active={x.feedback === "rejected"} onClick={() => feedback(x.id, "rejected", x.reject_reason ?? settings.reject_reasons[0])}>Rejected</Chip>
              {x.feedback === "rejected" && (
                <Select className="h-7 w-auto py-0 text-[12px] md:h-7" value={x.reject_reason ?? ""} onChange={(e) => feedback(x.id, "rejected", e.target.value)}>
                  {settings.reject_reasons.map((r) => <option key={r}>{r}</option>)}
                </Select>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dashed border-line p-3">
        <p className="mb-2 text-[13px] font-medium">Add unit</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Input placeholder="Project *" value={u.project} onChange={(e) => setU({ ...u, project: e.target.value })} />
          <Select value={u.developer_id} onChange={(e) => setU({ ...u, developer_id: e.target.value })}>
            <option value="">Developer</option>
            {developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Input placeholder="Unit type" value={u.unit_type} onChange={(e) => setU({ ...u, unit_type: e.target.value })} />
          <Input placeholder="Price AED" inputMode="numeric" value={u.price} onChange={(e) => setU({ ...u, price: e.target.value.replace(/\D/g, "") })} />
        </div>
        <Button className="mt-2" size="sm" disabled={!u.project.trim()} loading={saving} onClick={add}>Add to shortlist</Button>
      </div>
    </div>
  );
}

function DetailsTab({ lead, meetings: _m, deals: _d }: { lead: Lead; meetings: Meeting[]; deals: Deal[] }) {
  const router = useRouter();
  const { isFounder, team, toast } = useActions();
  const [f, setF] = useState({ name: lead.name, email: lead.email ?? "", alt_phone: lead.alt_phone ?? "", nationality: lead.nationality ?? "" });
  const [owner, setOwner] = useState(lead.owner_id ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabaseBrowser().from("leads").update({ name: f.name, email: f.email || null, alt_phone: f.alt_phone || null, nationality: f.nationality || null }).eq("id", lead.id);
    setSaving(false);
    if (error) toast(error.message, "error"); else { toast("Saved"); router.refresh(); }
  }
  async function reassign() {
    const { error } = await supabaseBrowser().rpc("reassign_lead", { p_lead: lead.id, p_owner: owner });
    if (error) toast(error.message, "error"); else { toast("Lead reassigned"); router.refresh(); }
  }
  async function del() {
    if (!confirm(`Delete ${lead.name} permanently? This removes the whole history.`)) return;
    const { error } = await supabaseBrowser().rpc("delete_lead", { p_lead: lead.id });
    if (error) toast(error.message, "error"); else { toast("Lead deleted"); router.push("/leads"); }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone" hint="Phone is the unique key and cannot be changed"><Input value={lead.phone} disabled /></Field>
        <Field label="Alternate phone"><Input value={f.alt_phone} onChange={(e) => setF({ ...f, alt_phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Nationality"><Input value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} /></Field>
        <Field label="Source"><Input value={`${SOURCE_META[lead.source].label}${lead.campaign ? ` · ${lead.campaign}` : ""}${lead.ad_name ? ` · ${lead.ad_name}` : ""}`} disabled /></Field>
      </div>
      <Button onClick={save} loading={saving}>Save details</Button>

      {isFounder && (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <p className="text-[13px] font-semibold">Founder</p>
          <div className="flex gap-2">
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {team.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}{t.on_leave ? " (on leave)" : ""}</option>)}
            </Select>
            <Button variant="secondary" disabled={owner === lead.owner_id} onClick={reassign}>Reassign</Button>
          </div>
          <Button variant="ghost" className="text-danger" onClick={del}><Trash2 className="size-4" /> Delete lead</Button>
        </div>
      )}
    </div>
  );
}
