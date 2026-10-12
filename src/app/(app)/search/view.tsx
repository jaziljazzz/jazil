"use client";

import { ArrowLeft, Briefcase, Search, User, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LeadCard, LeadList } from "@/components/lead-card";
import { useActions } from "@/components/actions";
import { Badge, cn, Skeleton } from "@/components/ui";
import { aed, fmtDate } from "@/lib/format";
import { LEAD_CARD_FIELDS } from "@/lib/fields";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Deal, Lead } from "@/lib/types";

type Scope = "leads" | "deals";

export function SearchView() {
  const router = useRouter();
  const { isFounder, team, profile } = useActions();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("leads");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const owners = Object.fromEntries(team.map((t) => [t.id, t.name]));

  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    const term = q.replace(/[%,()]/g, " ").trim();
    if (term.length < 2) { setLeads(null); setDeals(null); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const sb = supabaseBrowser();
      const digits = term.replace(/\D/g, "");
      if (scope === "leads") {
        const { data } = await sb.from("leads").select(LEAD_CARD_FIELDS)
          .or(`name.ilike.%${term}%,email.ilike.%${term}%${digits.length >= 3 ? `,phone.ilike.%${digits}%` : ""}`)
          .order("last_activity_at", { ascending: false }).limit(40);
        setLeads((data ?? []) as Lead[]);
      } else {
        const { data } = await sb.from("deals").select("*, lead:leads(name,phone)")
          .or(`project.ilike.%${term}%,unit.ilike.%${term}%`).order("booking_date", { ascending: false }).limit(40);
        setDeals((data ?? []) as Deal[]);
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, scope]);

  const results = scope === "leads" ? leads : deals;

  return (
    <div className="min-h-dvh bg-bg">
      <div className="sticky top-0 z-30 rounded-b-2xl bg-surface px-3 pb-3 shadow-sm" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <div className="flex items-center gap-2">
          <button onClick={() => (history.length > 1 ? router.back() : router.push("/leads"))} className="grid size-11 shrink-0 place-items-center rounded-full active:bg-black/5" aria-label="Back">
            <ArrowLeft className="size-6" />
          </button>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={scope === "leads" ? "Search by name, phone or email" : "Search by project or unit"}
              className="h-12 w-full rounded-xl border border-line bg-bg pl-10 pr-10 text-[16px] outline-none focus:border-brand focus:bg-surface"
              enterKeyHint="search"
            />
            {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted" aria-label="Clear"><X className="size-4" /></button>}
          </div>
        </div>
        <div className="mt-3 flex gap-2 pl-1">
          {([["leads", "Leads", User], ["deals", "Deals", Briefcase]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setScope(k)}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[14px] font-medium",
                scope === k ? "border-brand bg-brand-50 text-brand" : "border-transparent bg-bg text-ink/70")}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-3 pb-28">
        {q.trim().length < 2 ? (
          <div className="pt-[30vh] text-center">
            <p className="text-[18px] font-medium text-ink">Search Anything</p>
            <p className="mt-1 text-[14px] text-muted">Start typing a keyword to begin your search.</p>
          </div>
        ) : loading && !results ? (
          <LeadList>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</LeadList>
        ) : results && results.length === 0 ? (
          <div className="pt-[25vh] text-center">
            <p className="text-[17px] font-medium">No results</p>
            <p className="mt-1 text-[14px] text-muted">Nothing matches “{q}”.</p>
          </div>
        ) : scope === "leads" ? (
          <LeadList>{(leads ?? []).map((l) => <LeadCard key={l.id} lead={l} ownerName={isFounder && l.owner_id !== profile.id ? owners[l.owner_id ?? ""] : undefined} />)}</LeadList>
        ) : (
          <div className="space-y-3">
            {(deals ?? []).map((d) => (
              <Link key={d.id} href={`/leads/${d.lead_id}`} className="block rounded-2xl border border-line/70 bg-surface p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[16px] font-medium">{d.project} {d.unit}</p>
                  <Badge tone={d.cancelled ? "muted" : d.commission_status === "received" ? "success" : "warning"}>{d.cancelled ? "Cancelled" : d.commission_status === "received" ? "Received" : "Pending"}</Badge>
                </div>
                <p className="mt-1 text-[13px] text-muted">{d.lead?.name} · {fmtDate(d.booking_date)}</p>
                <p className="tabular mt-1 text-[14px]">{aed(d.sale_value)} · <span className="font-medium text-success">{aed(d.commission_amount)}</span></p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
