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

/** Lead card: name, stage chip, coloured follow up, source icon, budget, call + WhatsApp.
 *  Swipe right → Log call, swipe left → Reschedule. */
export function LeadCard({ lead, ownerName, onLogged }: { lead: Lead; ownerName?: string; onLogged?: () => void }) {
  const { call, whatsapp, logCall, reschedule } = useActions();
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const moved = useRef(false);
  const budget = budgetLabel(lead.requirements);
  const open = lead.stage !== "won" && lead.stage !== "lost";

  return (
    <div className="relative overflow-hidden rounded-[12px]">
      {open && (
        <div className="absolute inset-0 flex items-center justify-between px-5 text-[13px] font-semibold text-white">
          <span className={cn("flex items-center gap-2 transition-opacity", dx > 20 ? "opacity-100" : "opacity-0")}>
            <Phone className="size-4" /> Log call
          </span>
          <span className={cn("flex items-center gap-2 transition-opacity", dx < -20 ? "opacity-100" : "opacity-0")}>
            Reschedule
          </span>
          <div className={cn("absolute inset-0 -z-10", dx > 0 ? "bg-success" : "bg-warning")} />
        </div>
      )}
      <div
        className="relative flex items-center gap-3 border border-line bg-surface p-3 transition-transform duration-150 rounded-[12px] touch-pan-y"
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
            setDx(Math.max(-120, Math.min(120, ddx)));
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
        <Link
          href={`/leads/${lead.id}`}
          className="min-w-0 flex-1"
          onClick={(e) => { if (moved.current) e.preventDefault(); }}
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{lead.name}</span>
            <SourceIcon source={lead.source} />
            {lead.sla_breached && <Badge tone="danger">SLA</Badge>}
            {lead.is_stale && <Badge tone="warning">Stale</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StageChip stage={lead.stage} />
            <DueText lead={lead} />
            {budget && <span className="text-[12px] text-muted">· {budget}</span>}
            {ownerName && <span className="text-[12px] text-muted">· {ownerName}</span>}
          </div>
        </Link>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={() => call(lead)} className="grid size-11 place-items-center rounded-full border border-line text-success hover:bg-success-50" aria-label="Call">
            <Phone className="size-[18px]" />
          </button>
          <button onClick={() => whatsapp(lead)} className="grid size-11 place-items-center rounded-full border border-line text-[#25D366] hover:bg-success-50" aria-label="WhatsApp">
            <MessageCircle className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
