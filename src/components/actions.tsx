"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { OUTCOMES, SOURCE_META, STAGE_META, STAGES } from "@/lib/constants";
import { aed, errMsg, waLink } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CallOutcome, Developer, Lead, Profile, Settings, Source, Stage } from "@/lib/types";
import { FollowupPicker } from "./followup-picker";
import { emptyStageForm, RequirementFields, stageNeedsFollowup, StageFields, validateStage, type StageForm } from "./stage-fields";
import { Button, Chip, cn, ErrorText, Field, Input, Select, Sheet, Textarea } from "./ui";

export type LeadRef = Pick<Lead, "id" | "name" | "phone" | "stage"> & Partial<Pick<Lead, "attempt_count" | "next_followup_at" | "selected_project" | "selected_unit" | "owner_id">>;

type Toast = { id: number; text: string; tone: "success" | "error" };

interface Ctx {
  profile: Profile;
  isFounder: boolean;
  settings: Settings;
  developers: Developer[];
  team: Profile[];
  call: (lead: LeadRef, onSaved?: () => void) => void;
  whatsapp: (lead: LeadRef) => void;
  logCall: (lead: LeadRef, onSaved?: () => void) => void;
  changeStage: (lead: LeadRef, to: Stage, onSaved?: () => void) => void;
  reschedule: (lead: LeadRef) => void;
  addNote: (lead: LeadRef) => void;
  scheduleMeeting: (lead: LeadRef) => void;
  markWon: (lead: LeadRef) => void;
  addLead: () => void;
  toast: (text: string, tone?: "success" | "error") => void;
}

const ActionsContext = createContext<Ctx | null>(null);
export function useActions() {
  const c = useContext(ActionsContext);
  if (!c) throw new Error("useActions outside provider");
  return c;
}

type Open =
  | { kind: "call"; lead: LeadRef; onSaved?: () => void }
  | { kind: "stage"; lead: LeadRef; to: Stage; onSaved?: () => void }
  | { kind: "reschedule"; lead: LeadRef }
  | { kind: "note"; lead: LeadRef }
  | { kind: "meeting"; lead: LeadRef }
  | { kind: "won"; lead: LeadRef }
  | { kind: "add" }
  | null;

/** Saves requirement / first unit rows a stage needs, and returns the p_data payload for the RPC. */
async function prepareStage(leadId: string, stage: Stage, f: StageForm) {
  const sb = supabaseBrowser();
  if (stage === "contacted") {
    const { nationality, is_nri, ...req } = f.req;
    const hasAny = Object.values(req).some((v) => v !== null && v !== undefined && v !== "");
    if (hasAny) {
      const { error } = await sb.from("requirements").upsert({ ...req, lead_id: leadId }, { onConflict: "lead_id" });
      if (error) throw error;
    }
    if (nationality || is_nri !== undefined) {
      await sb.from("leads").update({ nationality: nationality || null, is_nri: !!is_nri }).eq("id", leadId);
    }
  }
  if (stage === "shortlisting" && !f.hasUnits && f.unit.project.trim()) {
    const { error } = await sb.from("shortlisted_units").insert({
      lead_id: leadId,
      project: f.unit.project.trim(),
      developer_id: f.unit.developer_id || null,
      unit_type: f.unit.unit_type || null,
      price: f.unit.price ? Number(f.unit.price) : null,
    });
    if (error) throw error;
  }
  return {
    meeting_type: f.meeting_type || undefined,
    meeting_at: f.meeting_at ? new Date(f.meeting_at).toISOString() : undefined,
    location: f.location || undefined,
    selected_project: f.selected_project || undefined,
    selected_unit: f.selected_unit || undefined,
    lost_reason: f.lost_reason || undefined,
  };
}

async function loadStageContext(lead: LeadRef): Promise<StageForm> {
  const sb = supabaseBrowser();
  const [{ data: req }, { count }, { data: l }] = await Promise.all([
    sb.from("requirements").select("*").eq("lead_id", lead.id).maybeSingle(),
    sb.from("shortlisted_units").select("id", { count: "exact", head: true }).eq("lead_id", lead.id),
    sb.from("leads").select("nationality,is_nri,selected_project,selected_unit").eq("id", lead.id).single(),
  ]);
  const f = emptyStageForm();
  if (req) {
    f.req = { ...req };
    f.hasRequirement = !!(req.budget_max || req.budget_min || req.area || req.bedrooms);
  }
  f.req.nationality = l?.nationality ?? "";
  f.req.is_nri = l?.is_nri ?? false;
  f.hasUnits = (count ?? 0) > 0;
  f.selected_project = l?.selected_project ?? "";
  f.selected_unit = l?.selected_unit ?? "";
  return f;
}

export function ActionsProvider({ profile, settings, developers, team, children }: { profile: Profile; settings: Settings; developers: Developer[]; team: Profile[]; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const isFounder = profile.role === "founder";

  const toast = useCallback((text: string, tone: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const close = useCallback(() => setOpen(null), []);
  const done = useCallback((msg: string, cb?: () => void) => {
    setOpen(null);
    toast(msg);
    router.refresh();
    cb?.();
  }, [router, toast]);

  // Tap phone → dialer; when the agent comes back, the Log call sheet opens for that lead.
  const pendingRef = useRef<{ lead: LeadRef; at: number } | null>(null);
  const pendingCb = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("aventus.pendingCall");
      if (raw) pendingRef.current = JSON.parse(raw);
    } catch {}
    const onVisible = () => {
      const p = pendingRef.current;
      if (document.visibilityState === "visible" && p && Date.now() - p.at > 2500) {
        pendingRef.current = null;
        try { sessionStorage.removeItem("aventus.pendingCall"); } catch {}
        setOpen({ kind: "call", lead: p.lead, onSaved: pendingCb.current });
        pendingCb.current = undefined;
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const value = useMemo<Ctx>(() => ({
    profile, isFounder, settings, developers, team, toast,
    call: (lead, onSaved) => {
      const p = { lead, at: Date.now() };
      pendingRef.current = p;
      pendingCb.current = onSaved;
      try { sessionStorage.setItem("aventus.pendingCall", JSON.stringify(p)); } catch {}
      window.location.href = `tel:${lead.phone}`;
    },
    whatsapp: (lead) => {
      window.open(waLink(lead.phone, `Hi ${lead.name.split(" ")[0]}, this is ${profile.name} from ${settings.company_name}.`), "_blank");
      supabaseBrowser().rpc("log_whatsapp", { p_lead: lead.id }).then(() => router.refresh());
    },
    logCall: (lead, onSaved) => setOpen({ kind: "call", lead, onSaved }),
    changeStage: (lead, to, onSaved) => {
      if (to === "won") setOpen({ kind: "won", lead });
      else setOpen({ kind: "stage", lead, to, onSaved });
    },
    reschedule: (lead) => setOpen({ kind: "reschedule", lead }),
    addNote: (lead) => setOpen({ kind: "note", lead }),
    scheduleMeeting: (lead) => setOpen({ kind: "meeting", lead }),
    markWon: (lead) => setOpen({ kind: "won", lead }),
    addLead: () => setOpen({ kind: "add" }),
  }), [profile, isFounder, settings, developers, team, toast, router]);

  return (
    <ActionsContext.Provider value={value}>
      {children}
      {open?.kind === "call" && <LogCallSheet lead={open.lead} onClose={close} onDone={() => done("Call logged", open.onSaved)} />}
      {open?.kind === "stage" && <StageSheet lead={open.lead} to={open.to} onClose={close} onDone={() => done(`Moved to ${STAGE_META[open.to].label}`, open.onSaved)} />}
      {open?.kind === "reschedule" && <RescheduleSheet lead={open.lead} onClose={close} onDone={() => done("Follow up rescheduled")} />}
      {open?.kind === "note" && <NoteSheet lead={open.lead} onClose={close} onDone={() => done("Note added")} />}
      {open?.kind === "meeting" && <MeetingSheet lead={open.lead} onClose={close} onDone={() => done("Meeting scheduled")} />}
      {open?.kind === "won" && <WonSheet lead={open.lead} onClose={close} onDone={() => done("Deal booked 🎉")} />}
      {open?.kind === "add" && <AddLeadSheet onClose={close} onDone={(id) => { setOpen(null); toast("Lead added"); router.push(`/leads/${id}`); }} />}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className={cn("animate-pop pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white shadow-lg", t.tone === "success" ? "bg-ink" : "bg-danger")}>
            {t.tone === "success" ? <CheckCircle2 className="size-4 text-success" /> : <AlertCircle className="size-4" />}
            {t.text}
          </div>
        ))}
      </div>
    </ActionsContext.Provider>
  );
}

// ───────────────────────────── Log call ─────────────────────────────
function LogCallSheet({ lead, onClose, onDone }: { lead: LeadRef; onClose: () => void; onDone: () => void }) {
  const { settings, developers } = useActions();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [form, setForm] = useState<StageForm>(emptyStageForm());
  const [next, setNext] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stage) loadStageContext(lead).then(setForm);
  }, [stage, lead]);

  const target = stage ?? lead.stage;
  const closed = target === "won" || target === "lost";
  const needsNext = outcome !== "wrong_number" && !closed && !(stage === "meeting");
  const stageErr = stage ? validateStage(stage, form) : null;
  const canSave = !!outcome && (outcome !== "connected" || note.trim().length > 0) && (!needsNext || !!next) && !stageErr;
  const stageOptions = STAGES.filter((s) => s !== lead.stage && s !== "won");

  async function save() {
    if (!outcome) return;
    setSaving(true);
    setError(null);
    try {
      const sb = supabaseBrowser();
      const p_data = stage ? await prepareStage(lead.id, stage, form) : {};
      const { error } = await sb.rpc("log_call", {
        p_lead: lead.id,
        p_outcome: outcome,
        p_note: note || null,
        p_next: next?.toISOString() ?? null,
        p_stage: outcome === "wrong_number" ? null : stage,
        p_data,
      });
      if (error) throw error;
      onDone();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={<>Log call · <span className="font-normal text-muted">{lead.name}</span></>}
      footer={
        <Button className="w-full" size="lg" disabled={!canSave} loading={saving} onClick={save}>
          {!outcome ? "Pick an outcome" : needsNext && !next ? "Set the next follow up" : "Save call"}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setOutcome(o.value)}
              className={cn(
                "h-12 rounded-xl border text-[14px] font-medium transition-colors",
                outcome === o.value
                  ? o.tone === "success" ? "border-success bg-success text-white"
                  : o.tone === "danger" ? "border-danger bg-danger text-white"
                  : "border-brand bg-brand text-white"
                  : "border-line bg-surface hover:bg-bg",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {outcome === "wrong_number" && (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger">This will move the lead to Lost (Not genuine).</p>
        )}
        <Field label="Note" required={outcome === "connected"}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={outcome === "connected" ? "What did the client say?" : "Optional"} rows={2} />
        </Field>
        {outcome && outcome !== "wrong_number" && (
          <div className="space-y-2">
            <span className="text-[12px] font-medium text-muted">Move stage (optional)</span>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              {stageOptions.map((s) => (
                <Chip key={s} active={stage === s} onClick={() => setStage(stage === s ? null : s)}>{STAGE_META[s].label}</Chip>
              ))}
            </div>
            {stage && (
              <div className="rounded-xl border border-line bg-bg/60 p-3">
                <StageFields stage={stage} form={form} setForm={setForm} developers={developers} lostReasons={settings.lost_reasons} />
                {stageErr && <p className="mt-2 text-[12px] text-warning">{stageErr}</p>}
              </div>
            )}
          </div>
        )}
        {needsNext && <FollowupPicker value={next} onChange={setNext} attempt={lead.attempt_count ?? 0} cadence={settings.cadence_days} />}
        {stage === "meeting" && <p className="text-[12px] text-muted">Next follow up will be set to the meeting time.</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ───────────────────────────── Stage change ─────────────────────────────
function StageSheet({ lead, to, onClose, onDone }: { lead: LeadRef; to: Stage; onClose: () => void; onDone: () => void }) {
  const { settings, developers } = useActions();
  const [form, setForm] = useState<StageForm | null>(null);
  const [note, setNote] = useState("");
  const [next, setNext] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadStageContext(lead).then(setForm); }, [lead]);

  const backwards = lead.stage !== "lost" && STAGES.indexOf(to) < STAGES.indexOf(lead.stage);
  const needsNext = stageNeedsFollowup(to);
  const stageErr = form ? validateStage(to, form) : "Loading…";
  const canSave = !stageErr && (!needsNext || !!next) && (!backwards || note.trim().length > 0);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const p_data = await prepareStage(lead.id, to, form);
      const { error } = await supabaseBrowser().rpc("change_stage", { p_lead: lead.id, p_to: to, p_note: note || null, p_next: next?.toISOString() ?? null, p_data });
      if (error) throw error;
      onDone();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const m = STAGE_META[to];
  return (
    <Sheet
      open
      onClose={onClose}
      title={<>Move to <span style={{ color: m.color }}>{m.label}</span></>}
      footer={<Button className="w-full" size="lg" disabled={!canSave} loading={saving} onClick={save}>Move to {m.label}</Button>}
    >
      <div className="space-y-4">
        <p className="text-[13px] text-muted">{lead.name} · Needed: {m.next}</p>
        {form ? <StageFields stage={to} form={form} setForm={setForm} developers={developers} lostReasons={settings.lost_reasons} /> : <div className="skeleton h-24" />}
        {(backwards || to === "lost" || to === "new") && (
          <Field label={backwards ? "Why is it moving back?" : "Note"} required={backwards}>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        {needsNext && <FollowupPicker value={next} onChange={setNext} attempt={lead.attempt_count ?? 0} cadence={settings.cadence_days} />}
        {stageErr && form && <p className="text-[12px] text-warning">{stageErr}</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ───────────────────────────── Reschedule / note / meeting ─────────────────────────────
function RescheduleSheet({ lead, onClose, onDone }: { lead: LeadRef; onClose: () => void; onDone: () => void }) {
  const { settings } = useActions();
  const [next, setNext] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setSaving(true);
    const { error } = await supabaseBrowser().rpc("set_followup", { p_lead: lead.id, p_next: next!.toISOString(), p_note: note || null });
    setSaving(false);
    if (error) setError(error.message); else onDone();
  }
  return (
    <Sheet open onClose={onClose} title={<>Reschedule · <span className="font-normal text-muted">{lead.name}</span></>}
      footer={<Button className="w-full" size="lg" disabled={!next} loading={saving} onClick={save}>Save follow up</Button>}>
      <div className="space-y-4">
        <FollowupPicker value={next} onChange={setNext} attempt={lead.attempt_count ?? 0} cadence={settings.cadence_days} />
        <Field label="Reason (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Client travelling, asked to call Monday…" /></Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function NoteSheet({ lead, onClose, onDone }: { lead: LeadRef; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setSaving(true);
    const { error } = await supabaseBrowser().rpc("add_note", { p_lead: lead.id, p_note: note });
    setSaving(false);
    if (error) setError(error.message); else onDone();
  }
  return (
    <Sheet open onClose={onClose} title={<>Add note · <span className="font-normal text-muted">{lead.name}</span></>}
      footer={<Button className="w-full" size="lg" disabled={!note.trim()} loading={saving} onClick={save}>Save note</Button>}>
      <Textarea autoFocus rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a note…" />
      <div className="mt-3"><ErrorText>{error}</ErrorText></div>
    </Sheet>
  );
}

function MeetingSheet({ lead, onClose, onDone }: { lead: LeadRef; onClose: () => void; onDone: () => void }) {
  const { settings, developers } = useActions();
  const [form, setForm] = useState<StageForm>(emptyStageForm());
  const [moveStage, setMoveStage] = useState(STAGES.indexOf(lead.stage) < STAGES.indexOf("meeting"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = form.meeting_type && form.meeting_at;
  async function save() {
    setSaving(true);
    setError(null);
    const sb = supabaseBrowser();
    const at = new Date(form.meeting_at).toISOString();
    const res = moveStage
      ? await sb.rpc("change_stage", { p_lead: lead.id, p_to: "meeting", p_data: { meeting_type: form.meeting_type, meeting_at: at, location: form.location || undefined } })
      : await sb.rpc("schedule_meeting", { p_lead: lead.id, p_type: form.meeting_type, p_at: at, p_location: form.location || null });
    setSaving(false);
    if (res.error) setError(res.error.message); else onDone();
  }
  return (
    <Sheet open onClose={onClose} title={<>Schedule meeting · <span className="font-normal text-muted">{lead.name}</span></>}
      footer={<Button className="w-full" size="lg" disabled={!ok} loading={saving} onClick={save}>Schedule</Button>}>
      <div className="space-y-4">
        <StageFields stage="meeting" form={form} setForm={setForm} developers={developers} lostReasons={settings.lost_reasons} />
        {lead.stage !== "won" && lead.stage !== "lost" && lead.stage !== "meeting" && (
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="size-5 accent-brand" checked={moveStage} onChange={(e) => setMoveStage(e.target.checked)} />
            Also move the lead to the Meeting stage
          </label>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ───────────────────────────── Mark Won (deal form) ─────────────────────────────
function WonSheet({ lead, onClose, onDone }: { lead: LeadRef; onClose: () => void; onDone: () => void }) {
  const { developers, team, isFounder, profile } = useActions();
  const today = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState({
    developer_id: "",
    project: lead.selected_project ?? "",
    unit: lead.selected_unit ?? "",
    sale_value: "",
    commission_pct: "",
    agent_id: lead.owner_id ?? profile.id,
    split_agent_id: "",
    split_pct: "",
    booked_via: "Direct",
    booking_date: today,
    expected_commission_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }));
  const amount = Number(d.sale_value || 0) * Number(d.commission_pct || 0) / 100;
  const agents = team.filter((t) => t.active);
  const ok = d.project.trim() && d.sale_value && d.commission_pct !== "";

  async function save() {
    setSaving(true);
    setError(null);
    const { error } = await supabaseBrowser().rpc("mark_won", { p_lead: lead.id, p_deal: d });
    setSaving(false);
    if (error) setError(error.message); else onDone();
  }

  return (
    <Sheet open onClose={onClose} wide title={<>Mark Won · <span className="font-normal text-muted">{lead.name}</span></>}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] text-muted">Commission<div className="tabular text-[16px] font-semibold text-success">{aed(amount)}</div></div>
          <Button variant="success" size="lg" disabled={!ok} loading={saving} onClick={save}>Book deal</Button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Developer">
          <Select value={d.developer_id} onChange={(e) => {
            const dev = developers.find((x) => x.id === e.target.value);
            setD((x) => ({ ...x, developer_id: e.target.value, commission_pct: dev ? String(dev.default_commission_pct) : x.commission_pct }));
          }}>
            <option value="">—</option>
            {developers.map((dv) => <option key={dv.id} value={dv.id}>{dv.name} ({dv.default_commission_pct}%)</option>)}
          </Select>
        </Field>
        <Field label="Project" required><Input value={d.project} onChange={(e) => set("project", e.target.value)} /></Field>
        <Field label="Unit"><Input value={d.unit} onChange={(e) => set("unit", e.target.value)} /></Field>
        <Field label="Sale value (AED)" required><Input inputMode="numeric" value={d.sale_value} onChange={(e) => set("sale_value", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
        <Field label="Commission %" required><Input inputMode="decimal" value={d.commission_pct} onChange={(e) => set("commission_pct", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
        <Field label="Booked via">
          <Select value={d.booked_via} onChange={(e) => set("booked_via", e.target.value)}>
            {["Direct", "Developer sales office", "Co-broker", "Other"].map((o) => <option key={o}>{o}</option>)}
          </Select>
        </Field>
        {isFounder && (
          <Field label="Agent credited">
            <Select value={d.agent_id} onChange={(e) => set("agent_id", e.target.value)}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Split with (optional)">
          <Select value={d.split_agent_id} onChange={(e) => set("split_agent_id", e.target.value)}>
            <option value="">No split</option>
            {agents.filter((a) => a.id !== d.agent_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        {d.split_agent_id && <Field label="Split %"><Input inputMode="numeric" value={d.split_pct} onChange={(e) => set("split_pct", e.target.value.replace(/[^\d.]/g, ""))} placeholder="50" /></Field>}
        <Field label="Booking date"><Input type="date" value={d.booking_date} onChange={(e) => set("booking_date", e.target.value)} /></Field>
        <Field label="Expected commission date"><Input type="date" value={d.expected_commission_date} onChange={(e) => set("expected_commission_date", e.target.value)} /></Field>
      </div>
      <div className="mt-3"><ErrorText>{error}</ErrorText></div>
    </Sheet>
  );
}

// ───────────────────────────── Add lead ─────────────────────────────
const COUNTRY_CODES = ["+971", "+966", "+974", "+965", "+968", "+973", "+91", "+92", "+44", "+1", "+7", "+49", "+33", "+86", "+20", "+961", "+962"];

function AddLeadSheet({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { isFounder, team } = useActions();
  const [name, setName] = useState("");
  const [cc, setCc] = useState("+971");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<Source>("instagram");
  const [owner, setOwner] = useState("");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [showReq, setShowReq] = useState(false);
  const [req, setReq] = useState<StageForm["req"]>({});
  const [dup, setDup] = useState<null | { exists: boolean; valid: boolean; mine?: boolean; lead_id?: string; owner_name?: string; stage?: Stage }>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = phone.trim().startsWith("+") ? phone.trim() : `${cc}${phone.replace(/^0+/, "")}`;
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) { setDup(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabaseBrowser().rpc("check_phone", { p_phone: full });
      setDup(data);
    }, 350);
    return () => clearTimeout(t);
  }, [phone, full]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const sb = supabaseBrowser();
      const { data, error } = await sb.rpc("add_lead", {
        p_name: name, p_phone: full, p_source: source, p_email: email || null, p_note: note || null,
        p_nationality: req.nationality || null, p_owner: isFounder && owner ? owner : null,
      });
      if (error) throw error;
      if (data.status === "invalid") throw new Error("Phone number looks invalid");
      if (showReq) {
        const { nationality: _n, is_nri, ...r } = req;
        if (Object.values(r).some((v) => v !== null && v !== undefined && v !== "")) {
          await sb.from("requirements").upsert({ ...r, lead_id: data.lead_id }, { onConflict: "lead_id" });
        }
        if (is_nri) await sb.from("leads").update({ is_nri: true }).eq("id", data.lead_id);
      }
      onDone(data.lead_id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const blocked = dup?.exists;
  return (
    <Sheet open onClose={onClose} title="Add lead"
      footer={<Button className="w-full" size="lg" disabled={!name.trim() || phone.replace(/\D/g, "").length < 7 || !!blocked} loading={saving} onClick={save}>Add lead</Button>}>
      <div className="space-y-3">
        <Field label="Name" required><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" /></Field>
        <Field label="Phone" required>
          <div className="flex gap-2">
            <Select className="w-28 shrink-0" value={cc} onChange={(e) => setCc(e.target.value)}>
              {COUNTRY_CODES.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="50 123 4567" />
          </div>
        </Field>
        {dup?.exists && (
          <div className="rounded-lg bg-warning-50 px-3 py-2 text-[13px] text-warning">
            Already in the CRM{dup.owner_name ? ` · owned by ${dup.owner_name}` : ""} ({dup.stage && STAGE_META[dup.stage].label}).
            {dup.mine && dup.lead_id && <a className="ml-1 font-medium underline" href={`/leads/${dup.lead_id}`}>Open lead</a>}
          </div>
        )}
        {dup && !dup.valid && <p className="text-[12px] text-danger">Phone number looks invalid</p>}
        <Field label="Source">
          <div className="flex flex-wrap gap-2">
            {(isFounder ? (["instagram", "bought", "meta"] as Source[]) : (["instagram"] as Source[])).map((s) => (
              <Chip key={s} active={source === s} onClick={() => setSource(s)}>{s === "instagram" ? "Instagram / walk in" : SOURCE_META[s].label}</Chip>
            ))}
          </div>
        </Field>
        {isFounder && (
          <Field label="Assign to" hint={source === "instagram" ? "Defaults to you" : "Defaults to round robin"}>
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">{source === "instagram" ? "Me" : "Round robin"}</option>
              {team.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Note"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Where did they come from? What do they want?" /></Field>
        {!showReq ? (
          <button type="button" className="text-[13px] font-medium text-brand" onClick={() => setShowReq(true)}>+ Add requirement and email</button>
        ) : (
          <div className="space-y-3 rounded-xl border border-line p-3">
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <RequirementFields value={req} onChange={setReq} />
          </div>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
