"use client";

import { CalendarClock, CalendarDays, MoreVertical, Phone, PhoneCall, RotateCcw, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { dueInfo, fmtDate, fmtTime } from "@/lib/format";
import type { Lead } from "@/lib/types";
import { useActions } from "./actions";
import { Swipeable } from "./lead-card";
import { cn, StageChip } from "./ui";

/** A follow-up as a task card (LeadSquared Tasks style). */
export function TaskCard({ lead, ownerName, onLogged }: { lead: Lead; ownerName?: string; onLogged?: () => void }) {
  const { call, whatsapp, logCall, reschedule } = useActions();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);
  const untouched = lead.stage === "new" && !lead.first_called_at && !lead.next_followup_at;
  const due = dueInfo(lead.next_followup_at);
  const status = untouched ? { t: "New lead", c: "text-info" } : due.tone === "overdue" ? { t: "Overdue", c: "text-danger" } : due.tone === "today" ? { t: "Due today", c: "text-warning" } : { t: "Upcoming", c: "text-muted" };
  const when = untouched ? lead.assigned_at : lead.next_followup_at;

  return (
    <Swipeable onRight={() => call(lead, onLogged)} onLeft={() => whatsapp(lead)}>
      <div className="rounded-2xl border border-line/70 bg-surface p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        <div className="flex items-center justify-between">
          <span className={cn("grid size-9 place-items-center rounded-lg", untouched ? "bg-info-50 text-info" : "bg-[#fce7f3] text-[#db2777]")}>
            <CalendarClock className="size-5" />
          </span>
          <div className="relative flex items-center gap-1">
            <span className={cn("text-[13px] font-medium", status.c)}>{status.t}</span>
            <button onClick={() => setMenu((m) => !m)} className="grid size-9 place-items-center rounded-full text-ink/70 active:bg-black/5" aria-label="More"><MoreVertical className="size-5" /></button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="animate-pop absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
                  <Link href={`/leads/${lead.id}`} className="flex items-center gap-2.5 px-4 py-3 text-[14px] active:bg-bg"><User className="size-4 text-muted" />Open lead</Link>
                  {!untouched && <button onClick={() => { setMenu(false); reschedule(lead); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[14px] active:bg-bg"><RotateCcw className="size-4 text-muted" />Reschedule</button>}
                  <button onClick={() => { setMenu(false); whatsapp(lead); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[14px] active:bg-bg"><PhoneCall className="size-4 text-muted" />WhatsApp</button>
                </div>
              </>
            )}
          </div>
        </div>
        <Link href={`/leads/${lead.id}`} className="mt-2 block">
          <p className="break-words text-[16px] font-semibold leading-snug text-ink/90">{untouched ? "First Call" : "Phone Call Follow Up"}: {lead.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            {ownerName && <span><span className="font-medium text-ink/70">Owner:</span> {ownerName}</span>}
            <StageChip stage={lead.stage} />
            <span className="tabular">{lead.phone}</span>
          </div>
          {when && (
            <div className="mt-2 flex items-center gap-4 text-[13px] text-ink/70">
              <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-muted" />{untouched ? "Assigned " : "Due "}{fmtDate(when, { day: "numeric", month: "short", year: "2-digit" })}, {fmtTime(when)}</span>
              {lead.attempt_count > 0 && <span className="text-muted">Attempt {lead.attempt_count + 1}</span>}
            </div>
          )}
        </Link>
        <div className="mt-3 flex gap-2.5">
          <button onClick={() => call(lead, onLogged)} className="grid h-11 w-14 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand active:scale-95" aria-label="Call"><Phone className="size-5" /></button>
          <button onClick={() => logCall(lead, onLogged)} className="h-11 flex-1 rounded-lg bg-brand-50 text-[15px] font-medium text-brand active:bg-brand/15">Start Task</button>
        </div>
      </div>
    </Swipeable>
  );
}
