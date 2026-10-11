"use client";

import { AlertTriangle, Camera as Instagram, Megaphone, MessageCircle, Phone, ShoppingBag } from "lucide-react";
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

const AVATAR_TONES = ["#1e40af", "#0e7490", "#7c3aed", "#c026d3", "#ea580c", "#16a34a", "#0f766e", "#b45309"];
export function LeadAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-semibold text-white", className)} style={{ background: AVATAR_TONES[h % AVATAR_TONES.length] }}>
      {initials}
    </span>
  );
}

/** Lead row (LeadSquared style): avatar, name, stage + coloured follow up, source/budget/owner, call + WhatsApp.
 *  Swipe right → Log call, swipe left → Reschedule. Render inside <LeadList>. */
export function LeadCard({ lead, ownerName, onLogged }: { lead: Lead; ownerName?: string; onLogged?: () => void }) {
  const { call, whatsapp, logCall, reschedule } = useActions();
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const moved = useRef(false);
  const budget = budgetLabel(lead.requirements);
  const open = lead.stage !== "won" && lead.stage !== "lost";
  const meta = [SOURCE_SHORT[lead.source], budget, ownerName].filter(Boolean).join(" · ");

  return (
    <div className="relative overflow-hidden">
      {open && dx !== 0 && (
        <div className={cn("absolute inset-0 flex items-center justify-between px-5 text-[13px] font-semibold text-white", dx > 0 ? "bg-success" : "bg-warning")}>
          <span className="flex items-center gap-2"><Phone className="size-4" /> Log call</span>
          <span>Reschedule</span>
        </div>
      )}
      <div
        className="relative flex items-center gap-3 bg-surface px-3.5 py-3 transition-transform duration-150 touch-pan-y active:bg-bg"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: start.current?.swiping ? "0ms" : undefined }}
        onPointerDown={(e) => {
          if (!open || e.pointerType === "mouse") return;
          start.current = { x: e.clientX, y: e.clientY, swiping: false };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const ddx = e.clientX - s.x;
          if (!s.swiping && Math.abs(ddx) > 12 && Math.abs(ddx) > Math.abs(e.clientY - s.y)) s.swiping = true;
          if (s.swiping) {
            moved.current = true;
            setDx(Math.max(-110, Math.min(110, ddx)));
          }
        }}
        onPointerUp={() => {
          if (dx > 80) logCall(lead, onLogged);
          else if (dx < -80) reschedule(lead);
          start.current = null;
          setDx(0);
        }}
        onPointerCancel={() => { start.current = null; setDx(0); }}
      >
        <Link href={`/leads/${lead.id}`} className="flex min-w-0 flex-1 items-start gap-3" onClick={(e) => { if (moved.current) e.preventDefault(); }}>
          <LeadAvatar name={lead.name} />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 break-words text-[15px] font-semibold leading-snug">{lead.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <StageChip stage={lead.stage} />
              <DueText lead={lead} />
              {lead.sla_breached && <Badge tone="danger">SLA</Badge>}
              {lead.is_stale && <Badge tone="warning">Stale</Badge>}
            </div>
            {meta && <div className="mt-1 flex items-start gap-1 text-[12px] leading-snug text-muted"><SourceIcon source={lead.source} className="mt-0.5 size-3 shrink-0" /><span>{meta}</span></div>}
          </div>
        </Link>
        <div className="flex shrink-0 flex-col gap-2">
          <button onClick={() => call(lead)} className="grid size-9 place-items-center rounded-full bg-success-50 text-success active:scale-95" aria-label="Call">
            <Phone className="size-[17px]" />
          </button>
          <button onClick={() => whatsapp(lead)} className="grid size-9 place-items-center rounded-full bg-[#25D366]/10 text-[#1DA851] active:scale-95" aria-label="WhatsApp">
            <MessageCircle className="size-[17px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Groups lead rows into one card with dividers, like a native list. */
export function LeadList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface", className)}>{children}</div>;
}

const SOURCE_SHORT: Record<Source, string> = { bought: "Bought", meta: "Meta", instagram: "Instagram" };
