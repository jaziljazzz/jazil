"use client";

import { CheckCircle2, AlertCircle, PhoneCall } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { OUTCOMES, SOURCE_META, STAGE_META, STAGES } from "@/lib/constants";
import { aed, errMsg, waLink } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { goExternal, openWhatsApp } from "@/lib/whatsapp";
import { flushQueue, rpcOrQueue } from "@/lib/offline";
import type { CallOutcome, Developer, Lead, Profile, Settings, Source, Stage } from "@/lib/types";
import { FollowupPicker } from "./followup-picker";
import { NewLeadForm } from "./new-lead-form";
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
  starred: Set<string>;
  toggleStar: (leadId: string) => void;
  toast: (text: string, tone?: "success" | "error") => void;
}

const ActionsContext = createContext<Ctx | null>(null);
export function useActions() {
  const c = useContext(ActionsContext);
  if (!c) throw new Error("useActions outside provider");
  return c;
}

type Open =
  | { kind: "call"; lead: LeadRef; onSaved?: () => void; dial?: Dial }
  | { kind: "wa"; lead: LeadRef }
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

/** Merge loaded stage data under anything the user already typed, so a slow load never wipes their input. */
function mergeTyped(loaded: StageForm) {
  return (prev: StageForm | null): StageForm => {
    if (!prev) return loaded;
    const typed = Object.fromEntries(Object.entries(prev.req).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    return {
      ...loaded,
      req: { ...loaded.req, ...typed },
      unit: prev.unit.project ? prev.unit : loaded.unit,
      meeting_type: prev.meeting_type || loaded.meeting_type,
      meeting_at: prev.meeting_at || loaded.meeting_at,
      location: prev.location || loaded.location,
      selected_project: prev.selected_project || loaded.selected_project,
      selected_unit: prev.selected_unit || loaded.selected_unit,
      lost_reason: prev.lost_reason || loaded.lost_reason,
    };
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
  const [starred, setStarred] = useState<Set<string>>(new Set());
  useEffect(() => {
    supabaseBrowser().from("lead_stars").select("lead_id").then(({ data }: { data: { lead_id: string }[] | null }) => setStarred(new Set((data ?? []).map((r) => r.lead_id))));
  }, []);
  const toggleStar = useCallback((leadId: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      const sb = supabaseBrowser();
      if (next.has(leadId)) { next.delete(leadId); sb.from("lead_stars").delete().eq("lead_id", leadId).eq("user_id", profile.id).then(() => {}); }
      else { next.add(leadId); sb.from("lead_stars").insert({ lead_id: leadId }).then(() => {}); }
      return next;
    });
  }, [profile.id]);

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
  // A dial stays attached to the lead for 30 minutes, so closing and reopening Log call keeps it verified.
  const lastDial = useRef<Record<string, Dial & { until: number }>>({});
  const dialFor = (id: string) => {
    const d = lastDial.current[id];
    if (!d || d.until < Date.now()) return undefined;
    return { dialed_at: d.dialed_at, seconds: d.seconds };
  };
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
        const dial = { dialed_at: new Date(p.at).toISOString(), seconds: Math.round((Date.now() - p.at) / 1000) };
        lastDial.current[p.lead.id] = { ...dial, until: Date.now() + 30 * 60000 };
        setOpen({ kind: "call", lead: p.lead, onSaved: pendingCb.current, dial });
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

  const sendWhatsApp = useCallback((lead: LeadRef, text: string) => {
    openWhatsApp(lead.phone, text);
    rpcOrQueue("log_whatsapp", { p_lead: lead.id }, `WhatsApp · ${lead.name}`).then(() => router.refresh());
  }, [router]);

  // Send anything saved while offline as soon as the connection returns.
  useEffect(() => {
    const flush = () => flushQueue().then(({ sent, failed }) => {
      if (sent) { toast(`Synced ${sent} offline change${sent > 1 ? "s" : ""}`); router.refresh(); }
      failed.forEach((f) => toast(f, "error"));
    });
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [router, toast]);

  const value = useMemo<Ctx>(() => ({
    profile, isFounder, settings, developers, team, toast,
    call: (lead, onSaved) => {
      const p = { lead, at: Date.now() };
      pendingRef.current = p;
      pendingCb.current = onSaved;
      try { sessionStorage.setItem("aventus.pendingCall", JSON.stringify(p)); } catch {}
      goExternal(`tel:${lead.phone}`);
    },
    whatsapp: (lead) => {
      if ((settings.wa_templates ?? []).length) { setOpen({ kind: "wa", lead }); return; }
      sendWhatsApp(lead, `Hi ${lead.name.split(" ")[0]}, this is ${profile.name} from ${settings.company_name}.`);
    },
    logCall: (lead, onSaved) => setOpen({ kind: "call", lead, onSaved, dial: dialFor(lead.id) }),
    changeStage: (lead, to, onSaved) => {
      if (to === "won") setOpen({ kind: "won", lead });
      else setOpen({ kind: "stage", lead, to, onSaved });
    },
    reschedule: (lead) => setOpen({ kind: "reschedule", lead }),
    addNote: (lead) => setOpen({ kind: "note", lead }),
    scheduleMeeting: (lead) => setOpen({ kind: "meeting", lead }),
    markWon: (lead) => setOpen({ kind: "won", lead }),
    addLead: () => setOpen({ kind: "add" }),
    starred, toggleStar,
  }), [profile, isFounder, settings, developers, team, toast, router, starred, toggleStar, sendWhatsApp]);

  return (
    <ActionsContext.Provider value={value}>
      {children}
      {open?.kind === "call" && <LogCallSheet lead={open.lead} dial={open.dial} onClose={close} onDone={(q) => { delete lastDial.current[open.lead.id]; done(q ? "Saved offline — will sync when online" : "Call logged", open.onSaved); }} />}
      {open?.kind === "wa" && <WhatsAppSheet lead={open.lead} templates={settings.wa_templates ?? []} agent={profile.name} company={settings.company_name} onClose={close} onSend={(t) => { setOpen(null); sendWhatsApp(open.lead, t); }} />}
      {open?.kind === "stage" && <StageSheet lead={open.lead} to={open.to} onClose={close} onDone={() => done(`Moved to ${STAGE_META[open.to].label}`, open.onSaved)} />}
      {open?.kind === "reschedule" && <RescheduleSheet lead={open.lead} onClose={close} onDone={() => done("Follow up rescheduled")} />}
      {open?.kind === "note" && <NoteSheet lead={open.lead} onClose={close} onDone={() => done("Note added")} />}
      {open?.kind === "meeting" && <MeetingSheet lead={open.lead} onClose={close} onDone={() => done("Meeting scheduled")} />}
      {open?.kind === "won" && <WonSheet lead={open.lead} onClose={close} onDone={() => done("Deal booked 🎉")} />}
      {open?.kind === "add" && <NewLeadForm profile={profile} isFounder={isFounder} team={team} onClose={close} onDone={(id) => { setOpen(null); toast("Lead added"); router.push(`/leads/${id}`); }} />}
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
type Dial = { dialed_at: string; seconds: number };
function fmtDur(s: number) {
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
}

function LogCallSheet({ lead, onClose, onDone, dial }: { lead: LeadRef; onClose: () => void; onDone: (queued: boolean) => void; dial?: Dial }) {
  const { settings, developers } = useActions();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [form, setForm] = useState<StageForm>(emptyStageForm());
  const [next, setNext] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stage) loadStageContext(lead).then((f) => setForm((prev) => mergeTyped(f)(prev)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, lead.id]);

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
      const { error, queued } = await rpcOrQueue("log_call", {
        p_lead: lead.id,
        p_outcome: outcome,
        p_note: note || null,
        p_next: next?.toISOString() ?? null,
        p_stage: outcome === "wrong_number" ? null : stage,
        p_data,
        p_dial: dial ?? null,
      }, `Call · ${lead.name}`);
      if (error) throw error;
      onDone(queued);
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
        {dial ? (
          <p className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-[13px] font-medium text-success">
            <PhoneCall className="size-4" /> Dialed from CRM · {fmtDur(dial.seconds)} in the dialer
          </p>
        ) : (
          <p className="rounded-lg bg-bg px-3 py-2 text-[12px] text-muted">Not dialed from the CRM. Tap Call first so the call counts as verified.</p>
        )}
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
            <div className="flex flex-wrap gap-2">
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
  useEffect(() => {
    loadStageContext(lead).then((f) => setForm((prev) => mergeTyped(f)(prev)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

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
    const { error } = await rpcOrQueue("set_followup", { p_lead: lead.id, p_next: next!.toISOString(), p_note: note || null }, `Follow up · ${lead.name}`);
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
    const { error } = await rpcOrQueue("add_note", { p_lead: lead.id, p_note: note }, `Note · ${lead.name}`);
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
  useEffect(() => {
    // The lead on screen may be a moment old (e.g. right after moving to Negotiation), so read the saved unit.
    supabaseBrowser().from("leads").select("selected_project,selected_unit").eq("id", lead.id).single()
      .then(({ data }: { data: { selected_project: string | null; selected_unit: string | null } | null }) => {
        if (data) setD((x) => ({ ...x, project: x.project || data.selected_project || "", unit: x.unit || data.selected_unit || "" }));
      });
  }, [lead.id]);
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

// ───────────────────────────── WhatsApp templates ─────────────────────────────
function fillTemplate(body: string, lead: LeadRef, agent: string, company: string) {
  return body.replaceAll("{name}", lead.name.split(" ")[0] ?? lead.name).replaceAll("{fullname}", lead.name)
    .replaceAll("{agent}", agent).replaceAll("{company}", company);
}

function WhatsAppSheet({ lead, templates, agent, company, onClose, onSend }: {
  lead: LeadRef; templates: { title: string; body: string }[]; agent: string; company: string; onClose: () => void; onSend: (text: string) => void;
}) {
  return (
    <Sheet open onClose={onClose} title={<>WhatsApp · <span className="font-normal text-muted">{lead.name}</span></>}>
      <div className="space-y-2 pb-2">
        {templates.map((t) => {
          const text = fillTemplate(t.body, lead, agent, company);
          return (
            <button key={t.title} onClick={() => onSend(text)} className="block w-full rounded-xl border border-line p-3 text-left active:bg-bg">
              <p className="text-[14px] font-semibold text-[#128C7E]">{t.title}</p>
              <p className="mt-0.5 line-clamp-3 text-[13px] text-ink/75">{text}</p>
            </button>
          );
        })}
        <button onClick={() => onSend("")} className="block w-full rounded-xl border border-dashed border-line p-3 text-left text-[14px] font-medium text-muted active:bg-bg">
          Blank message
        </button>
      </div>
    </Sheet>
  );
}
