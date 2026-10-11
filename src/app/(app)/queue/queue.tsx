"use client";

import { ArrowLeft, CheckCircle2, ChevronRight, MessageCircle, Phone, SkipForward } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useActions } from "@/components/actions";
import { budgetLabel, DueText, SourceIcon } from "@/components/lead-card";
import { Button, Card, EmptyState, StageChip } from "@/components/ui";
import { SOURCE_META } from "@/lib/constants";
import type { Lead, Requirement } from "@/lib/types";

function reqSummary(r?: Requirement | Requirement[] | null) {
  const req = Array.isArray(r) ? r[0] : r;
  if (!req) return null;
  return [budgetLabel(req), req.bedrooms && `${req.bedrooms} BR`, req.area, req.ready_or_offplan === "offplan" ? "Off plan" : req.ready_or_offplan === "ready" ? "Ready" : null, req.purpose === "investment" ? "Investment" : req.purpose === "end_use" ? "End use" : null]
    .filter(Boolean).join(" · ");
}

export function TaskQueue({ leads, lastNote }: { leads: Lead[]; lastNote: Record<string, string> }) {
  const [list] = useState(leads);
  const [i, setI] = useState(0);
  const { call, whatsapp, logCall } = useActions();
  const lead = list[i];
  const next = () => setI((x) => x + 1);

  if (!lead) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <EmptyState icon={<CheckCircle2 className="size-6" />} title={list.length ? `Done — ${list.length} leads worked` : "Nothing in your queue"}
            action={<Link href="/today"><Button>Back to My Day</Button></Link>} />
        </Card>
      </div>
    );
  }

  const req = reqSummary(lead.requirements);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-lg flex-col px-4 py-4">
      <div className="flex items-center justify-between">
        <Link href="/today" className="flex items-center gap-1 text-[13px] text-muted"><ArrowLeft className="size-4" /> My Day</Link>
        <span className="tabular text-[13px] font-medium">{i + 1} of {list.length}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((i + 1) / list.length) * 100}%` }} />
      </div>

      <Card className="animate-pop mt-5 flex-1 p-5" key={lead.id}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold leading-tight">{lead.name}</h1>
            <p className="tabular mt-1 text-[14px] text-muted">{lead.phone}</p>
          </div>
          <StageChip stage={lead.stage} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <SourceIcon source={lead.source} /> {SOURCE_META[lead.source].label}{lead.campaign ? ` · ${lead.campaign}` : ""} · <DueText lead={lead} />
        </div>
        <div className="mt-5 space-y-3">
          <div>
            <p className="text-[12px] font-medium text-muted">Requirement</p>
            <p className="mt-0.5 text-[14px]">{req || <span className="text-muted">Not filled yet</span>}</p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-muted">Last note</p>
            <p className="mt-0.5 text-[14px]">{lastNote[lead.id] || <span className="text-muted">No notes yet</span>}</p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-muted">Attempts</p>
            <p className="tabular mt-0.5 text-[14px]">{lead.attempt_count}</p>
          </div>
        </div>
        <Link href={`/leads/${lead.id}`} className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-brand">Open full lead <ChevronRight className="size-4" /></Link>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button size="lg" variant="success" className="h-14 text-[16px]" onClick={() => call(lead, next)}><Phone className="size-5" /> Call</Button>
        <Button size="lg" variant="secondary" className="h-14 text-[16px]" onClick={() => whatsapp(lead)}><MessageCircle className="size-5 text-[#25D366]" /> WhatsApp</Button>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
        <Button size="lg" onClick={() => logCall(lead, next)}>Log call</Button>
        <Button size="lg" variant="ghost" onClick={next}><SkipForward className="size-4" /> Skip</Button>
      </div>
    </div>
  );
}
