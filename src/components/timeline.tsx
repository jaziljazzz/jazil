"use client";

import { ArrowRight, CalendarClock, CircleDot, Copy, FileText, Handshake, MessageCircle, Phone, PhoneOff, Repeat, StickyNote, Users } from "lucide-react";
import { useState } from "react";
import { MEETING_LABEL, OUTCOME_LABEL, STAGE_META } from "@/lib/constants";
import { dayKey, fmtDate, fmtDateTime, fmtTime, relative } from "@/lib/format";
import type { Activity, MeetingType } from "@/lib/types";
import { Chip, cn } from "./ui";

const ICONS: Record<Activity["type"], { icon: typeof Phone; cls: string }> = {
  call: { icon: Phone, cls: "bg-success-50 text-success" },
  note: { icon: StickyNote, cls: "bg-black/5 text-ink" },
  stage_change: { icon: ArrowRight, cls: "bg-brand-50 text-brand" },
  meeting: { icon: Users, cls: "bg-[#FDF4FF] text-[#C026D3]" },
  reassignment: { icon: Repeat, cls: "bg-warning-50 text-warning" },
  whatsapp: { icon: MessageCircle, cls: "bg-success-50 text-[#25D366]" },
  followup: { icon: CalendarClock, cls: "bg-warning-50 text-warning" },
  system: { icon: CircleDot, cls: "bg-info-50 text-info" },
  duplicate: { icon: Copy, cls: "bg-warning-50 text-warning" },
  deal: { icon: Handshake, cls: "bg-success-50 text-success" },
};

function title(a: Activity) {
  switch (a.type) {
    case "call": return `Call: ${a.call_outcome ? OUTCOME_LABEL[a.call_outcome] : ""}`;
    case "stage_change": return `Stage: ${a.from_stage ? STAGE_META[a.from_stage].label : "—"} → ${a.to_stage ? STAGE_META[a.to_stage].label : "—"}`;
    case "note": return "Note";
    case "meeting": {
      const t = (a.meta?.meeting_at as string) ? ` · ${fmtDateTime(a.meta.meeting_at as string)}` : "";
      return (a.note ?? "Meeting") + t;
    }
    case "reassignment": return a.note ?? "Reassigned";
    case "whatsapp": return "WhatsApp chat";
    case "followup": return "Follow up rescheduled";
    case "duplicate": return "Came in again";
    case "deal": return a.note ?? "Deal update";
    default: return a.note ?? "Update";
  }
}

const FILTERS: { key: string; label: string; types: Activity["type"][] }[] = [
  { key: "all", label: "All", types: [] },
  { key: "calls", label: "Calls", types: ["call", "whatsapp"] },
  { key: "notes", label: "Notes", types: ["note"] },
  { key: "stage", label: "Stage", types: ["stage_change", "deal"] },
  { key: "meetings", label: "Meetings", types: ["meeting"] },
  { key: "system", label: "System", types: ["system", "reassignment", "duplicate", "followup"] },
];

export function Timeline({ activities, compact }: { activities: Activity[]; compact?: boolean }) {
  const [filter, setFilter] = useState("all");
  const f = FILTERS.find((x) => x.key === filter)!;
  const list = f.types.length ? activities.filter((a) => f.types.includes(a.type)) : activities;
  const groups: { day: string; items: Activity[] }[] = [];
  list.forEach((a) => {
    const k = dayKey(a.created_at);
    const g = groups[groups.length - 1];
    if (g && g.day === k) g.items.push(a); else groups.push({ day: k, items: [a] });
  });
  const today = dayKey(new Date());

  return (
    <div>
      {!compact && (
        <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
          {FILTERS.map((x) => <Chip key={x.key} active={filter === x.key} onClick={() => setFilter(x.key)} className="h-7 text-[12px]">{x.label}</Chip>)}
        </div>
      )}
      {groups.length === 0 && <p className="py-6 text-center text-[13px] text-muted">No activity yet</p>}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.day}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {g.day === today ? "Today" : fmtDate(g.items[0]!.created_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </p>
            <ol className="relative space-y-3 border-l border-line pl-5">
              {g.items.map((a) => {
                const I = a.type === "call" && a.call_outcome && a.call_outcome !== "connected" ? { icon: PhoneOff, cls: "bg-warning-50 text-warning" } : ICONS[a.type] ?? { icon: FileText, cls: "" };
                const Icon = I.icon;
                const showNote = a.note && !["reassignment", "meeting", "deal"].includes(a.type);
                return (
                  <li key={a.id} className="relative">
                    <span className={cn("absolute -left-[33px] top-0 grid size-6 place-items-center rounded-full ring-4 ring-surface", I.cls)}>
                      <Icon className="size-3.5" />
                    </span>
                    <div className="text-[13px] font-medium">{title(a)}</div>
                    {showNote && a.type !== "system" && <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-ink/80">{a.note}</p>}
                    {a.type === "system" && a.note && <p className="mt-0.5 text-[13px] text-ink/80">{a.note}</p>}
                    {a.next_followup_at && <p className="mt-0.5 text-[12px] text-muted">Next follow up: {fmtDateTime(a.next_followup_at)}</p>}
                    {a.type === "stage_change" && a.meta?.meeting_type ? (
                      <p className="mt-0.5 text-[12px] text-muted">{MEETING_LABEL[a.meta.meeting_type as MeetingType]}{a.meta.meeting_at ? ` · ${fmtDateTime(a.meta.meeting_at as string)}` : ""}</p>
                    ) : null}
                    {a.type === "stage_change" && a.meta?.lost_reason ? <p className="mt-0.5 text-[12px] text-muted">Reason: {String(a.meta.lost_reason)}</p> : null}
                    <p className="mt-0.5 text-[12px] text-muted" title={fmtDateTime(a.created_at)}>
                      {fmtTime(a.created_at)} · {a.user?.name ?? "Automation"} · {relative(a.created_at)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
