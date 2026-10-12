import Link from "next/link";
import { getSession, getTeam, LEAD_LIST_FIELDS } from "@/lib/session";
import { endOfDay } from "@/lib/format";
import { STAGES, STAGE_META } from "@/lib/constants";
import type { Lead } from "@/lib/types";
import { LeadsView } from "./leads-view";
import { LeadPreview } from "./preview";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

type Q = { view?: string; q?: string; source?: string; agent?: string; from?: string; to?: string; preview?: string; page?: string };

const PAGE = 50;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const sp = await searchParams;
  const { supabase, isFounder, profile } = await getSession();
  const team = await getTeam();
  const view = sp.view || "open";
  const nowIso = new Date().toISOString();
  const eod = endOfDay().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyView = (q: any, v: string) => {
    switch (v) {
      case "open": return q.not("stage", "in", "(won,lost)");
      case "overdue": return q.not("stage", "in", "(won,lost)").lt("next_followup_at", nowIso);
      case "today": return q.not("stage", "in", "(won,lost)").gte("next_followup_at", nowIso).lt("next_followup_at", eod);
      case "untouched": return q.eq("stage", "new").is("first_called_at", null);
      case "nofollowup": return q.not("stage", "in", "(won,lost,new)").is("next_followup_at", null);
      case "stale": return q.eq("is_stale", true).not("stage", "in", "(won,lost)");
      case "sla": return q.eq("sla_breached", true);
      case "all": return q;
      default: return STAGES.includes(v as never) ? q.eq("stage", v) : q;
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (q: any) => {
    if (sp.agent && isFounder) q = q.eq("owner_id", sp.agent);
    if (sp.source) q = q.eq("source", sp.source);
    if (sp.from) q = q.gte("created_at", new Date(sp.from).toISOString());
    if (sp.to) q = q.lt("created_at", new Date(new Date(sp.to).getTime() + 86400000).toISOString());
    if (sp.q) {
      const term = sp.q.replace(/[%,()]/g, " ").trim();
      const digits = term.replace(/\D/g, "");
      q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%${digits.length >= 3 ? `,phone.ilike.%${digits}%` : ""}`);
    }
    return q;
  };

  const views = [
    { key: "open", label: "All open" },
    { key: "overdue", label: "Overdue", tone: "danger" as const },
    { key: "today", label: "Due today", tone: "warning" as const },
    { key: "untouched", label: "Untouched", tone: "info" as const },
    { key: "nofollowup", label: "No follow up", tone: "warning" as const },
    { key: "stale", label: "Stale", tone: "warning" as const },
    { key: "sla", label: "SLA breached", tone: "danger" as const },
    ...STAGES.map((s) => ({ key: s, label: STAGE_META[s].label })),
    { key: "all", label: "Everything" },
  ];

  const page = Math.max(1, Number(sp.page || 1));
  const listQ = applyFilters(applyView(supabase.from("leads").select(LEAD_LIST_FIELDS, { count: "exact" }), view))
    .order(view === "untouched" ? "assigned_at" : "next_followup_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);

  const [list, countsRes] = await Promise.all([
    listQ,
    supabase.rpc("lead_view_counts", {
      p_agent: isFounder && sp.agent ? sp.agent : null,
      p_source: sp.source || null,
      p_from: sp.from ? new Date(sp.from).toISOString() : null,
      p_to: sp.to ? new Date(new Date(sp.to).getTime() + 86400000).toISOString() : null,
      p_q: sp.q?.replace(/[%,()]/g, " ").trim() || null,
      p_eod: eod,
    }),
  ]);
  const counts = (countsRes.data ?? {}) as Record<string, number>;

  const preview = sp.preview ? <LeadPreview id={sp.preview} /> : null;
  const owners = Object.fromEntries(team.map((t) => [t.id, t.name]));

  return (
    <div className="flex">
      <LeadsView
        leads={(list.data ?? []) as Lead[]}
        total={list.count ?? 0}
        page={page}
        pageSize={PAGE}
        views={views.map((v) => ({ ...v, count: counts[v.key] ?? 0 }))}
        current={view}
        params={sp}
        team={isFounder ? team.filter((t) => t.active) : []}
        owners={isFounder ? owners : {}}
        meId={profile.id}
      />
      {preview && (
        <aside className="sticky top-0 hidden h-dvh w-[420px] shrink-0 overflow-y-auto border-l border-line bg-surface xl:block">
          <div className="flex justify-end p-2">
            <Link href={`/leads?${new URLSearchParams(Object.entries({ ...sp, preview: "" }).filter(([, v]) => v) as [string, string][])}`} className="rounded-lg px-2 py-1 text-[12px] text-muted hover:bg-black/5">Close ✕</Link>
          </div>
          {preview}
        </aside>
      )}
    </div>
  );
}
