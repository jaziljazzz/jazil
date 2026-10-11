"use client";

import { BEDROOMS, MEETING_TYPES, PAYMENT_PLANS } from "@/lib/constants";
import type { Developer, MeetingType, Requirement, Stage } from "@/lib/types";
import { Chip, Field, Input, Select } from "./ui";

export interface StageForm {
  req: Partial<Requirement> & { nationality?: string; is_nri?: boolean };
  hasRequirement: boolean;
  unit: { project: string; developer_id: string; unit_type: string; price: string };
  hasUnits: boolean;
  meeting_type: MeetingType | "";
  meeting_at: string;
  location: string;
  selected_project: string;
  selected_unit: string;
  lost_reason: string;
}

export const emptyStageForm = (): StageForm => ({
  req: {},
  hasRequirement: false,
  unit: { project: "", developer_id: "", unit_type: "", price: "" },
  hasUnits: false,
  meeting_type: "",
  meeting_at: "",
  location: "",
  selected_project: "",
  selected_unit: "",
  lost_reason: "",
});

export function stageNeedsFollowup(stage: Stage) {
  return ["contacted", "shortlisting", "negotiation"].includes(stage);
}

/** Returns an error string if the form does not satisfy the stage's entry requirements. */
export function validateStage(stage: Stage, f: StageForm): string | null {
  if (stage === "contacted") {
    const r = f.req;
    if (!f.hasRequirement && !r.budget_max && !r.budget_min && !r.area && !r.bedrooms) return "Fill the requirement card (budget, area or bedrooms)";
  }
  if (stage === "shortlisting" && !f.hasUnits && !f.unit.project.trim()) return "Add at least one shortlisted unit";
  if (stage === "meeting" && (!f.meeting_type || !f.meeting_at)) return "Meeting type, date and time are required";
  if (stage === "negotiation" && (!f.selected_project.trim() || !f.selected_unit.trim())) return "Selected project and unit are required";
  if (stage === "lost" && !f.lost_reason) return "Pick a lost reason";
  return null;
}

export function RequirementFields({ value, onChange }: { value: StageForm["req"]; onChange: (v: StageForm["req"]) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Budget min (AED)">
        <Input inputMode="numeric" value={value.budget_min ?? ""} onChange={(e) => set("budget_min", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} placeholder="800,000" />
      </Field>
      <Field label="Budget max (AED)">
        <Input inputMode="numeric" value={value.budget_max ?? ""} onChange={(e) => set("budget_max", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} placeholder="1,500,000" />
      </Field>
      <Field label="Preferred area">
        <Input value={value.area ?? ""} onChange={(e) => set("area", e.target.value || null)} placeholder="JVC, Downtown…" />
      </Field>
      <Field label="Bedrooms">
        <Select value={value.bedrooms ?? ""} onChange={(e) => set("bedrooms", e.target.value || null)}>
          <option value="">—</option>
          {BEDROOMS.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
      </Field>
      <Field label="Ready or off plan">
        <Select value={value.ready_or_offplan ?? ""} onChange={(e) => set("ready_or_offplan", e.target.value || null)}>
          <option value="">—</option>
          <option value="ready">Ready</option>
          <option value="offplan">Off plan</option>
          <option value="either">Either</option>
        </Select>
      </Field>
      <Field label="Handover year">
        <Input inputMode="numeric" value={value.handover_year ?? ""} onChange={(e) => set("handover_year", e.target.value ? Number(e.target.value) : null)} placeholder="2028" />
      </Field>
      <Field label="Payment plan">
        <Select value={value.payment_plan ?? ""} onChange={(e) => set("payment_plan", e.target.value || null)}>
          <option value="">—</option>
          {PAYMENT_PLANS.map((p) => <option key={p}>{p}</option>)}
        </Select>
      </Field>
      <Field label="Purpose">
        <Select value={value.purpose ?? ""} onChange={(e) => set("purpose", e.target.value || null)}>
          <option value="">—</option>
          <option value="end_use">End use</option>
          <option value="investment">Investment</option>
        </Select>
      </Field>
      <Field label="Nationality">
        <Input value={value.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} placeholder="Indian, British…" />
      </Field>
      <label className="flex items-end gap-2 pb-2.5 text-[13px]">
        <input type="checkbox" className="size-5 accent-brand" checked={!!value.is_nri} onChange={(e) => set("is_nri", e.target.checked)} />
        NRI
      </label>
    </div>
  );
}

export function StageFields({ stage, form, setForm, developers, lostReasons }: {
  stage: Stage;
  form: StageForm;
  setForm: (f: StageForm) => void;
  developers: Developer[];
  lostReasons: string[];
}) {
  if (stage === "contacted") {
    return (
      <div className="space-y-2">
        <p className="text-[13px] font-medium">Requirement card {form.hasRequirement && <span className="text-success">· saved</span>}</p>
        <RequirementFields value={form.req} onChange={(req) => setForm({ ...form, req })} />
      </div>
    );
  }
  if (stage === "shortlisting") {
    if (form.hasUnits) return <p className="rounded-lg bg-success-50 px-3 py-2 text-[13px] text-success">Shortlisted units already added.</p>;
    const u = form.unit;
    const set = (k: keyof typeof u, v: string) => setForm({ ...form, unit: { ...u, [k]: v } });
    return (
      <div className="space-y-2">
        <p className="text-[13px] font-medium">First shortlisted unit</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project" required><Input value={u.project} onChange={(e) => set("project", e.target.value)} placeholder="Sobha Hartland II" /></Field>
          <Field label="Developer">
            <Select value={u.developer_id} onChange={(e) => set("developer_id", e.target.value)}>
              <option value="">—</option>
              {developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Unit type"><Input value={u.unit_type} onChange={(e) => set("unit_type", e.target.value)} placeholder="2BR" /></Field>
          <Field label="Price (AED)"><Input inputMode="numeric" value={u.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} /></Field>
        </div>
      </div>
    );
  }
  if (stage === "meeting") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {MEETING_TYPES.map((m) => (
            <Chip key={m.value} active={form.meeting_type === m.value} onClick={() => setForm({ ...form, meeting_type: m.value })}>{m.label}</Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date and time" required>
            <Input type="datetime-local" value={form.meeting_at} onChange={(e) => setForm({ ...form, meeting_at: e.target.value })} />
          </Field>
          <Field label="Location / link"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        </div>
      </div>
    );
  }
  if (stage === "negotiation") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Selected project" required><Input value={form.selected_project} onChange={(e) => setForm({ ...form, selected_project: e.target.value })} /></Field>
        <Field label="Unit" required><Input value={form.selected_unit} onChange={(e) => setForm({ ...form, selected_unit: e.target.value })} placeholder="Tower B · 1204" /></Field>
      </div>
    );
  }
  if (stage === "lost") {
    return (
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-muted">Lost reason <span className="text-danger">*</span></p>
        <div className="flex flex-wrap gap-2">
          {lostReasons.map((r) => (
            <Chip key={r} active={form.lost_reason === r} onClick={() => setForm({ ...form, lost_reason: r })}>{r}</Chip>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
