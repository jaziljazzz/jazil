"use client";

import { AlertTriangle, Camera as Instagram, ClipboardPen, Megaphone, Pencil, Phone, ShoppingBag, Star } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { aed, dueInfo } from "@/lib/format";
import type { Lead, Requirement, Source } from "@/lib/types";
import { useActions } from "./actions";
import { Badge, cn, StageChip } from "./ui";

export function SourceIcon({ source, className }: { source: Source; className?: string }) {
  const Icon = source === "instagram" ? Instagram : source === "meta" ? Megaphone : ShoppingBag;
  return <Icon className={cn("size-3.5 text-muted", className)} aria-label={source} />;
}

export function budgetLabel(req?: Requirement | Requirement[] | null) {
  const r = Array.isArray(req) ? req[0] : req;
  if (!r) return null;
  if (r.budget_max && r.budget_min) return `${aed(r.budget_min, true)}–${aed(r.budget_max, true).replace("AED ", "")}`;
  if (r.budget_max) return `≤ ${aed(r.budget_max, true)}`;
  if (r.budget_min) return `≥ ${aed(r.budget_min, true)}`;
  return null;
}

export function DueText({ lead }: { lead: Pick<Lead, "next_followup_at" | "stage" | "first_called_at"> }) {
  if (lead.stage === "won" || lead.stage === "lost") return null;
  if (lead.stage === "new" && !lead.first_called_at && !lead.next_followup_at) {
    return <span className="text-[12px] font-medium text-info">Not called yet</span>;
  }
  const d = dueInfo(lead.next_followup_at);
  if (d.tone === "none") {
    return <span className="inline-flex items-center gap-1 text-[12px] font-medium text-warning"><AlertTriangle className="size-3.5" />No follow up</span>;
  }
  return (
    <span className={cn("text-[12px] font-medium", d.tone === "overdue" ? "text-danger" : d.tone === "today" ? "text-warning" : "text-muted")}>
      {d.label}
    </span>
  );
}

const AVATAR_TONES = ["#1e40af", "#0e7490", "#7c3aed", "#c026d3", "#ea580c", "#16a34a", "#0f766e", "#b45309", "#be123c", "#4338ca"];
function tone(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

/** Pastel initials avatar (LeadSquared style). `solid` gives a filled circle for headers. */
export function LeadAvatar({ name, className, solid }: { name: string; className?: string; solid?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  const c = tone(name);
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-semibold", className)}
      style={solid ? { background: c, color: "#fff" } : { background: c + "1f", color: c }}>
      {initials}
    </span>
  );
}

/** The follow-up status pill shown on every card. */
export function StatusPill({ lead, onClick }: { lead: Pick<Lead, "next_followup_at" | "stage" | "first_called_at" | "lost_reason">; onClick?: () => void }) {
  let label: string, cls: string;
  if (lead.stage === "won") { label = "Deal Won"; cls = "bg-success-50 text-success"; }
  else if (lead.stage === "lost") { label = `Lost${lead.lost_reason ? ` · ${lead.lost_reason}` : ""}`; cls = "bg-black/5 text-muted"; }
  else if (lead.stage === "new" && !lead.first_called_at && !lead.next_followup_at) { label = "Phone Call Pending"; cls = "bg-danger-50 text-danger"; }
  else {
    const d = dueInfo(lead.next_followup_at);
    label = d.tone === "none" ? "No Follow-Up Set" : d.label;
    cls = d.tone === "overdue" ? "bg-danger-50 text-danger" : d.tone === "today" || d.tone === "none" ? "bg-warning-50 text-warning" : "bg-info-50 text-info";
  }
  const open = lead.stage !== "won" && lead.stage !== "lost";
  return (
    <button type="button" onClick={onClick} disabled={!open || !onClick}
      className={cn("inline-flex h-7 max-w-full items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium", cls)}>
      <span className="truncate">{label}</span>
      {open && onClick && <Pencil className="size-3.5 shrink-0" />}
    </button>
  );
}

/** Lead card (LeadSquared style): avatar, name, star; status pill + phone; details; Call · WhatsApp · Log call. */
export function LeadCard({ lead, ownerName, onLogged }: { lead: Lead; ownerName?: string; onLogged?: () => void }) {
  const { call, whatsapp, logCall, reschedule, starred, toggleStar } = useActions();
  const budget = budgetLabel(lead.requirements);
  const open = lead.stage !== "won" && lead.stage !== "lost";
  const isStar = starred.has(lead.id);
  const untouched = lead.stage === "new" && !lead.first_called_at && !lead.next_followup_at;
  const details = [budget, SOURCE_SHORT[lead.source] + (lead.campaign && lead.source === "meta" ? ` · ${lead.campaign}` : ""), ownerName].filter(Boolean).join(" · ");

  return (
    <Swipeable onRight={() => call(lead, onLogged)} onLeft={() => whatsapp(lead)}>
    <div className="rounded-2xl border border-line/70 bg-surface shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="px-4 pt-3.5">
        <div className="flex items-center gap-3">
          <LeadAvatar name={lead.name} className="size-11 text-[15px]" />
          <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-[17px] font-medium leading-snug text-ink/90">{lead.name}</p>
          </Link>
          <button type="button" onClick={() => toggleStar(lead.id)} className="grid size-10 shrink-0 place-items-center rounded-full active:bg-black/5" aria-label={isStar ? "Unstar" : "Star"}>
            <Star className={cn("size-[22px]", isStar ? "fill-[#EAB308] text-[#EAB308]" : "text-ink/60")} />
          </button>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <StatusPill lead={lead} onClick={open ? () => (untouched ? logCall(lead, onLogged) : reschedule(lead)) : undefined} />
          <a href={`tel:${lead.phone}`} onClick={(e) => { e.preventDefault(); call(lead, onLogged); }} className="tabular shrink-0 text-[14px] text-[#1d4f91]">{lead.phone}</a>
        </div>
        <Link href={`/leads/${lead.id}`} className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StageChip stage={lead.stage} />
          {lead.sla_breached && <Badge tone="danger">SLA</Badge>}
          {lead.is_stale && <Badge tone="warning">Stale</Badge>}
          {details && <span className="text-[13px] text-muted">{details}</span>}
        </Link>
      </div>
      <div className="mx-4 mt-3 border-t border-line" />
      <div className="grid grid-cols-3 py-1">
        <button onClick={() => call(lead, onLogged)} className="grid h-12 place-items-center text-[#2B3990] active:bg-black/5" aria-label="Call"><Phone className="size-[22px]" /></button>
        <button onClick={() => whatsapp(lead)} className="grid h-12 place-items-center text-[#2B3990] active:bg-black/5" aria-label="WhatsApp"><WhatsAppIcon className="size-[23px]" /></button>
        <button onClick={() => logCall(lead, onLogged)} className="grid h-12 place-items-center text-[#2B3990] active:bg-black/5" aria-label="Log call"><ClipboardPen className="size-[22px]" /></button>
      </div>
    </div>
    </Swipeable>
  );
}

/** Swipe right → Call, swipe left → WhatsApp (Business). Touch only; taps still work. Vibrates when the action will fire. */
export function Swipeable({ children, onRight, onLeft }: { children: React.ReactNode; onRight: () => void; onLeft: () => void }) {
  const [dx, setDxState] = useState(0);
  const dxRef = useRef(0);
  const setDx = (v: number) => { dxRef.current = v; setDxState(v); };
  const st = useRef<{ x: number; y: number; on: boolean; armed: boolean } | null>(null);
  const moved = useRef(false);
  const LIMIT = 120, FIRE = 72;
  const armed = Math.abs(dx) >= FIRE;
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {dx !== 0 && (
        <div className={cn("absolute inset-0 flex items-center px-6 text-[15px] font-semibold text-white transition-colors",
          dx > 0 ? (armed ? "justify-start bg-success" : "justify-start bg-success/60") : (armed ? "justify-end bg-[#128C7E]" : "justify-end bg-[#128C7E]/60"))}>
          {dx > 0
            ? <span className={cn("flex flex-col items-center gap-1 transition-transform", armed && "scale-110")}><Phone className="size-7" />Call</span>
            : <span className={cn("flex flex-col items-center gap-1 transition-transform", armed && "scale-110")}><WhatsAppIcon className="size-7" />WhatsApp</span>}
        </div>
      )}
      <div
        className="relative touch-pan-y transition-transform duration-200"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: st.current?.on ? "0ms" : undefined }}
        onPointerDown={(e) => { if (e.pointerType === "mouse") return; st.current = { x: e.clientX, y: e.clientY, on: false, armed: false }; moved.current = false; }}
        onPointerMove={(e) => {
          const s = st.current;
          if (!s) return;
          const d = e.clientX - s.x;
          if (!s.on && Math.abs(d) > 10 && Math.abs(d) > Math.abs(e.clientY - s.y) * 1.2) s.on = true;
          if (!s.on) return;
          moved.current = true;
          const v = Math.max(-LIMIT, Math.min(LIMIT, d));
          const nowArmed = Math.abs(v) >= FIRE;
          if (nowArmed && !s.armed) { try { navigator.vibrate?.(15); } catch {} }
          s.armed = nowArmed;
          setDx(v);
        }}
        onPointerUp={() => {
          const d = dxRef.current;
          if (d >= FIRE) onRight();
          else if (d <= -FIRE) onLeft();
          st.current = null;
          setDx(0);
        }}
        onPointerCancel={() => { st.current = null; setDx(0); }}
        onClickCapture={(e) => { if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; } }}
      >
        {children}
      </div>
    </div>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3.5 20.5l1.3-4.1A8.5 8.5 0 1 1 8 19.6l-4.5.9z" />
      <path d="M9 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.2-.1.4 0 .5.6 1 1.4 1.8 2.5 2.4.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.3.6-.2.9-1 1.6-1.9 1.6-2.9-.3-5.6-3-6-5.9 0-.4.1-.9.4-1.3z" />
    </svg>
  );
}

/** Stack of lead cards. */
export function LeadList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-3", className)}>{children}</div>;
}

const SOURCE_SHORT: Record<Source, string> = { bought: "Bought list", meta: "Meta", instagram: "Instagram" };
