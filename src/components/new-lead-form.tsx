"use client";

import { CalendarDays, ChevronDown, Smartphone, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { BEDROOMS, PAYMENT_PLANS, SOURCE_META, STAGE_META } from "@/lib/constants";
import { errMsg } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile, Source, Stage } from "@/lib/types";
import { Button, cn } from "./ui";

export const COUNTRIES = [
  { code: "+971", flag: "🇦🇪", name: "UAE" }, { code: "+91", flag: "🇮🇳", name: "India" }, { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" }, { code: "+965", flag: "🇰🇼", name: "Kuwait" }, { code: "+968", flag: "🇴🇲", name: "Oman" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain" }, { code: "+92", flag: "🇵🇰", name: "Pakistan" }, { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+1", flag: "🇺🇸", name: "USA / Canada" }, { code: "+7", flag: "🇷🇺", name: "Russia" }, { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+33", flag: "🇫🇷", name: "France" }, { code: "+86", flag: "🇨🇳", name: "China" }, { code: "+20", flag: "🇪🇬", name: "Egypt" },
  { code: "+961", flag: "🇱🇧", name: "Lebanon" }, { code: "+962", flag: "🇯🇴", name: "Jordan" }, { code: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" }, { code: "+98", flag: "🇮🇷", name: "Iran" }, { code: "+90", flag: "🇹🇷", name: "Turkey" },
];
const LANGUAGES = ["English", "Arabic", "Hindi", "Urdu", "Malayalam", "Tamil", "Russian", "French", "German", "Chinese", "Persian", "Other"];
const PROPERTY_TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse", "Plot", "Office / Commercial"];

/** Material-style outlined field: the label sits on the border, like LeadSquared. */
function OField({ label, required, children, icon, className, error }: { label: string; required?: boolean; children: ReactNode; icon?: ReactNode; className?: string; error?: boolean }) {
  return (
    <div className={cn("relative", className)}>
      <div className={cn("flex min-h-[54px] items-center rounded-[10px] border bg-surface focus-within:border-brand focus-within:ring-1 focus-within:ring-brand",
        error ? "border-danger" : "border-[#c9ccd3]")}>
        <div className="min-w-0 flex-1">{children}</div>
        {icon && <span className="pointer-events-none pr-3 text-[#3aa0a0]">{icon}</span>}
      </div>
      <span className="pointer-events-none absolute -top-2 left-3 bg-surface px-1 text-[12px] leading-4 text-muted">
        {required && <span className="text-danger">* </span>}{label}
      </span>
    </div>
  );
}
const inputCls = "h-[52px] w-full bg-transparent px-3.5 text-[16px] text-ink outline-none placeholder:text-muted/50 disabled:text-muted";
const selectCls = cn(inputCls, "appearance-none pr-9");

function SelectField({ label, value, onChange, options, required, placeholder = "", disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: (string | [string, string])[]; required?: boolean; placeholder?: string; disabled?: boolean;
}) {
  return (
    <OField label={label} required={required} icon={<ChevronDown className="size-5" />}>
      <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">{placeholder}</option>
        {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
      </select>
    </OField>
  );
}

function PhoneField({ label, required, cc, setCc, value, setValue, error }: { label: string; required?: boolean; cc: string; setCc: (v: string) => void; value: string; setValue: (v: string) => void; error?: boolean }) {
  const c = COUNTRIES.find((x) => x.code === cc) ?? COUNTRIES[0]!;
  return (
    <div className="flex gap-2.5">
      <div className="relative h-[54px] w-[86px] shrink-0 rounded-[10px] border border-[#c9ccd3] bg-surface focus-within:border-brand">
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-[20px]">{c.flag}<ChevronDown className="size-4 text-ink/70" /></span>
        <select aria-label="Country code" className="absolute inset-0 opacity-0" value={cc} onChange={(e) => setCc(e.target.value)}>
          {COUNTRIES.map((x) => <option key={x.code} value={x.code}>{x.flag} {x.name} ({x.code})</option>)}
        </select>
      </div>
      <OField label={label} required={required} icon={<Smartphone className="size-5" />} className="flex-1" error={error}>
        <div className="flex items-center">
          <span className="pl-3.5 text-[16px] text-muted">{cc}</span>
          <input type="tel" inputMode="tel" className={cn(inputCls, "pl-2")} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
      </OField>
    </div>
  );
}

function full(cc: string, n: string) {
  const t = n.trim();
  return t.startsWith("+") ? t : `${cc}${t.replace(/^0+/, "")}`;
}

export function NewLeadForm({ profile, isFounder, team, onClose, onDone }: {
  profile: Profile; isFounder: boolean; team: Profile[]; onClose: () => void; onDone: (id: string) => void;
}) {
  const [f, setF] = useState({
    name: "", cc: "+971", phone: "", altCc: "+971", alt: "", email: "", language: "", source: "instagram" as Source,
    owner: isFounder ? "" : profile.id, nationality: "", note: "",
    budget_min: "", budget_max: "", area: "", bedrooms: "", property_type: "", ready_or_offplan: "", handover_year: "", payment_plan: "", purpose: "",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const [dup, setDup] = useState<null | { exists: boolean; valid: boolean; mine?: boolean; lead_id?: string; owner_name?: string; stage?: Stage }>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (f.phone.replace(/\D/g, "").length < 7) { setDup(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabaseBrowser().rpc("check_phone", { p_phone: full(f.cc, f.phone) });
      setDup(data);
    }, 350);
    return () => clearTimeout(t);
  }, [f.phone, f.cc]);

  const valid = f.name.trim() && f.phone.replace(/\D/g, "").length >= 7 && !dup?.exists && dup?.valid !== false;

  async function save() {
    setTried(true);
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const sb = supabaseBrowser();
      const { data, error } = await sb.rpc("add_lead", {
        p_name: f.name, p_phone: full(f.cc, f.phone), p_source: f.source, p_email: f.email || null, p_note: f.note || null,
        p_nationality: f.nationality || null, p_owner: isFounder && f.owner ? f.owner : null,
      });
      if (error) throw error;
      if (data.status === "invalid") throw new Error("Phone number looks invalid");
      if (data.status === "duplicate") throw new Error("This phone number is already in the CRM");
      const id = data.lead_id as string;
      const extra: Record<string, unknown> = {};
      if (f.alt.trim()) extra.alt_phone = full(f.altCc, f.alt);
      if (f.language) extra.preferred_language = f.language;
      if (Object.keys(extra).length) await sb.from("leads").update(extra).eq("id", id);
      const req = {
        budget_min: f.budget_min ? Number(f.budget_min) : null, budget_max: f.budget_max ? Number(f.budget_max) : null,
        area: f.area || null, bedrooms: f.bedrooms || null, property_type: f.property_type || null,
        ready_or_offplan: f.ready_or_offplan || null, handover_year: f.handover_year ? Number(f.handover_year) : null,
        payment_plan: f.payment_plan || null, purpose: f.purpose || null,
      };
      if (Object.values(req).some((v) => v !== null)) await sb.from("requirements").upsert({ ...req, lead_id: id }, { onConflict: "lead_id" });
      onDone(id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const agents = team.filter((t) => t.active);
  const money = (k: "budget_min" | "budget_max") => (
    <input inputMode="numeric" className={inputCls} value={f[k] ? Number(f[k]).toLocaleString("en-US") : ""} onChange={(e) => set(k)(e.target.value.replace(/\D/g, ""))} />
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="animate-sheet flex h-full w-full flex-col bg-surface md:h-auto md:max-h-[92dvh] md:max-w-2xl md:rounded-2xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <button onClick={onClose} className="grid size-11 place-items-center rounded-full active:bg-black/5" aria-label="Close"><X className="size-6" /></button>
          <div className="leading-tight">
            <p className="text-[17px] font-semibold">New Lead Form</p>
            <p className="text-[12px] text-muted">Lead Details</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f6f7f9] px-4 pb-6">
          <h3 className="pb-4 pt-5 text-[14px] font-bold uppercase tracking-wide text-ink/85">Enter lead details</h3>
          <div className="space-y-5">
            <OField label="Name" required error={tried && !f.name.trim()}>
              <input className={inputCls} value={f.name} onChange={(e) => set("name")(e.target.value)} autoComplete="off" />
            </OField>
            <PhoneField label="Phone Number" required cc={f.cc} setCc={set("cc")} value={f.phone} setValue={set("phone")} error={(tried && f.phone.replace(/\D/g, "").length < 7) || !!dup?.exists} />
            {dup?.exists && (
              <p className="-mt-3 rounded-lg bg-warning-50 px-3 py-2 text-[13px] text-warning">
                Already in the CRM{dup.owner_name ? ` · owned by ${dup.owner_name}` : ""}{dup.stage ? ` (${STAGE_META[dup.stage].label})` : ""}.
                {dup.mine && dup.lead_id && <a className="ml-1 font-semibold underline" href={`/leads/${dup.lead_id}`}>Open lead</a>}
              </p>
            )}
            {dup && !dup.valid && <p className="-mt-3 text-[12px] text-danger">Phone number looks invalid</p>}
            <PhoneField label="Alternative Phone Number" cc={f.altCc} setCc={set("altCc")} value={f.alt} setValue={set("alt")} />
            <OField label="Email">
              <input type="email" inputMode="email" className={inputCls} value={f.email} onChange={(e) => set("email")(e.target.value)} />
            </OField>
            <SelectField label="Preferred Language" value={f.language} onChange={set("language")} options={LANGUAGES} />
            <OField label="Nationality">
              <input className={inputCls} value={f.nationality} onChange={(e) => set("nationality")(e.target.value)} />
            </OField>
            <SelectField label="Lead Source" required value={f.source} onChange={(v) => set("source")(v || "instagram")} disabled={!isFounder}
              options={isFounder ? (Object.keys(SOURCE_META) as Source[]).map((k) => [k, k === "instagram" ? "Instagram / Walk-in" : SOURCE_META[k].label]) : [["instagram", "Instagram / Walk-in (Manual Entry)"]]} />
            {isFounder ? (
              <SelectField label="Owner" required value={f.owner} onChange={set("owner")} placeholder={f.source === "instagram" ? profile.name : "Round robin"}
                options={agents.filter((a) => a.id !== profile.id || f.source !== "instagram").map((a) => [a.id, a.name + (a.on_leave ? " (on leave)" : "")])} />
            ) : (
              <SelectField label="Owner" required value={profile.id} onChange={() => {}} options={[[profile.id, profile.name]]} disabled />
            )}
            <OField label="Notes">
              <textarea rows={3} className="w-full resize-none bg-transparent px-3.5 py-3.5 text-[16px] outline-none" value={f.note} onChange={(e) => set("note")(e.target.value)} />
            </OField>
          </div>

          <h3 className="pb-4 pt-8 text-[14px] font-bold uppercase tracking-wide text-ink/85">Enter property requirement (optional)</h3>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <OField label="Budget Min (AED)">{money("budget_min")}</OField>
              <OField label="Budget Max (AED)">{money("budget_max")}</OField>
            </div>
            <OField label="Preferred Area / Community">
              <input className={inputCls} value={f.area} onChange={(e) => set("area")(e.target.value)} />
            </OField>
            <SelectField label="Property Type" value={f.property_type} onChange={set("property_type")} options={PROPERTY_TYPES} />
            <SelectField label="Bedrooms" value={f.bedrooms} onChange={set("bedrooms")} options={BEDROOMS} />
            <SelectField label="Ready or Off Plan" value={f.ready_or_offplan} onChange={set("ready_or_offplan")} options={[["ready", "Ready"], ["offplan", "Off plan"], ["either", "Either"]]} />
            <OField label="Handover Year" icon={<CalendarDays className="size-5" />}>
              <input inputMode="numeric" maxLength={4} className={inputCls} value={f.handover_year} onChange={(e) => set("handover_year")(e.target.value.replace(/\D/g, ""))} />
            </OField>
            <SelectField label="Payment Plan" value={f.payment_plan} onChange={set("payment_plan")} options={PAYMENT_PLANS} />
            <SelectField label="Purpose" value={f.purpose} onChange={set("purpose")} options={[["end_use", "End use"], ["investment", "Investment"]]} />
          </div>
          {error && <p className="mt-5 rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger">{error}</p>}
        </div>

        <div className="safe-bottom shrink-0 border-t border-line bg-surface px-4 py-3">
          <Button size="lg" className="h-[52px] w-full text-[16px]" loading={saving} onClick={save} disabled={!!dup?.exists}>Save Lead</Button>
        </div>
      </div>
    </div>
  );
}
