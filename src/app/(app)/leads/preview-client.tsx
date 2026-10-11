"use client";

import { MessageCircle, Phone, PhoneCall } from "lucide-react";
import Link from "next/link";
import { useActions } from "@/components/actions";
import { budgetLabel, DueText } from "@/components/lead-card";
import { Timeline } from "@/components/timeline";
import { Button, StageChip } from "@/components/ui";
import { SOURCE_META } from "@/lib/constants";
import type { Activity, Lead } from "@/lib/types";

export function PreviewClient({ lead, activities }: { lead: Lead; activities: Activity[] }) {
  const a = useActions();
  const open = lead.stage !== "won" && lead.stage !== "lost";
  return (
    <div className="space-y-4 px-5 pb-8">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[18px] font-semibold">{lead.name}</h2>
          <StageChip stage={lead.stage} />
        </div>
        <p className="tabular text-[13px] text-muted">{lead.phone} · {SOURCE_META[lead.source].label}{lead.owner?.name ? ` · ${lead.owner.name}` : ""}</p>
        <div className="mt-1"><DueText lead={lead} /> {budgetLabel(lead.requirements) && <span className="text-[12px] text-muted">· {budgetLabel(lead.requirements)}</span>}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => a.call(lead)}><Phone className="size-4 text-success" /> Call</Button>
        <Button size="sm" variant="secondary" onClick={() => a.whatsapp(lead)}><MessageCircle className="size-4 text-[#25D366]" /> WhatsApp</Button>
        <Button size="sm" onClick={() => a.logCall(lead)}><PhoneCall className="size-4" /> Log call</Button>
        {open && <Button size="sm" variant="secondary" onClick={() => a.reschedule(lead)}>Reschedule</Button>}
      </div>
      <Link href={`/leads/${lead.id}`} className="block text-[13px] font-medium text-brand">Open full lead →</Link>
      <Timeline activities={activities} compact />
    </div>
  );
}
