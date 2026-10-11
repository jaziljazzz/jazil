"use client";

import { Briefcase, FileUp, Paperclip } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useActions } from "@/components/actions";
import { Badge, Button, Card, Chip, EmptyState, ErrorText, Field, Input, PageHeader, Select, Sheet, StatCard } from "@/components/ui";
import { aed, errMsg, fmtDate } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Deal, Profile } from "@/lib/types";

type F = "all" | "pending" | "overdue" | "received" | "cancelled";

function isOverdue(d: Deal) {
  return !d.cancelled && d.commission_status === "pending" && !!d.expected_commission_date && d.expected_commission_date < new Date().toISOString().slice(0, 10);
}

export function DealsView({ deals, team }: { deals: Deal[]; team: Profile[] }) {
  const { isFounder } = useActions();
  const [f, setF] = useState<F>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const live = deals.filter((d) => !d.cancelled);
  const totals = {
    units: live.length,
    value: live.reduce((s, d) => s + Number(d.sale_value), 0),
    earned: live.reduce((s, d) => s + Number(d.commission_amount), 0),
    received: live.filter((d) => d.commission_status === "received").reduce((s, d) => s + Number(d.received_amount ?? d.commission_amount), 0),
  };
  const list = useMemo(() => deals.filter((d) =>
    f === "all" ? !d.cancelled :
    f === "pending" ? !d.cancelled && d.commission_status === "pending" :
    f === "overdue" ? isOverdue(d) :
    f === "received" ? !d.cancelled && d.commission_status === "received" : d.cancelled), [deals, f]);
  const count = (x: F) => deals.filter((d) =>
    x === "all" ? !d.cancelled : x === "pending" ? !d.cancelled && d.commission_status === "pending" : x === "overdue" ? isOverdue(d) : x === "received" ? !d.cancelled && d.commission_status === "received" : d.cancelled).length;
  const openDeal = deals.find((d) => d.id === openId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:px-8 md:py-8">
      <PageHeader title="Deals" sub="Units sold and commission tracking" />
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatCard label="Units sold" value={totals.units} />
        <StatCard label="Sale value" value={aed(totals.value, true)} />
        <StatCard label="Commission earned" value={aed(totals.earned, true)} tone="success" />
        <StatCard label="Commission received" value={aed(totals.received, true)} sub={`Pending ${aed(totals.earned - totals.received, true)}`} />
      </div>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {(["all", "pending", "overdue", "received", "cancelled"] as F[]).map((x) => (
          <Chip key={x} active={f === x} onClick={() => setF(x)} count={count(x)} tone={x === "overdue" && count(x) ? "danger" : undefined}>
            {x === "all" ? "All" : x[0]!.toUpperCase() + x.slice(1)}
          </Chip>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Briefcase className="size-6" />} title="No deals here yet" />
      ) : (
        <>
          <div className="mt-3 space-y-2 md:hidden">
            {list.map((d) => (
              <Card key={d.id} className="p-3">
                <button className="w-full text-left" onClick={() => setOpenId(d.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-semibold">{d.project} {d.unit}</p>
                      <p className="text-[12px] text-muted">{d.lead?.name} · {d.agent?.name} · {fmtDate(d.booking_date)}</p>
                    </div>
                    <StatusBadge d={d} />
                  </div>
                  <div className="mt-2 flex justify-between text-[13px]">
                    <span className="tabular text-muted">{aed(d.sale_value)}</span>
                    <span className="tabular font-semibold text-success">{aed(d.commission_amount)}</span>
                  </div>
                </button>
              </Card>
            ))}
          </div>
          <div className="mt-3 hidden overflow-hidden rounded-[12px] border border-line bg-surface md:block">
            <table className="w-full text-[13px]">
              <thead className="border-b border-line bg-bg/60 text-left text-[12px] text-muted">
                <tr>
                  {["Booked", "Client", "Project / unit", "Developer", "Agent", "Sale value", "Comm.", "Expected", "Status"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id} onClick={() => setOpenId(d.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-bg">
                    <td className="px-3 py-2.5 text-muted">{fmtDate(d.booking_date)}</td>
                    <td className="px-3 py-2.5 font-medium"><Link href={`/leads/${d.lead_id}`} onClick={(e) => e.stopPropagation()} className="hover:text-brand">{d.lead?.name}</Link></td>
                    <td className="px-3 py-2.5">{d.project} {d.unit && <span className="text-muted">· {d.unit}</span>}</td>
                    <td className="px-3 py-2.5 text-muted">{d.developer?.name ?? "—"}</td>
                    <td className="px-3 py-2.5">{d.agent?.name ?? "—"}{d.split_agent_id && <span className="text-muted"> +split</span>}</td>
                    <td className="tabular px-3 py-2.5">{aed(d.sale_value)}</td>
                    <td className="tabular px-3 py-2.5 font-medium text-success">{aed(d.commission_amount)} <span className="font-normal text-muted">({d.commission_pct}%)</span></td>
                    <td className="px-3 py-2.5 text-muted">{d.expected_commission_date ? fmtDate(d.expected_commission_date) : "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge d={d} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {openDeal && <DealSheet deal={openDeal} team={team} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function StatusBadge({ d }: { d: Deal }) {
  if (d.cancelled) return <Badge tone="muted">Cancelled</Badge>;
  if (d.commission_status === "received") return <Badge tone="success">Received</Badge>;
  if (isOverdue(d)) return <Badge tone="danger">Overdue</Badge>;
  return <Badge tone="warning">Pending</Badge>;
}

function DealSheet({ deal, team, onClose }: { deal: Deal; team: Profile[]; onClose: () => void }) {
  const router = useRouter();
  const { isFounder, profile, developers, toast } = useActions();
  const [recDate, setRecDate] = useState(new Date().toISOString().slice(0, 10));
  const [recAmount, setRecAmount] = useState(String(deal.commission_amount));
  const [expected, setExpected] = useState(deal.expected_commission_date ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = !deal.cancelled && (isFounder || (deal.agent_id === profile.id && deal.commission_status === "pending"));
  const splitName = team.find((t) => t.id === deal.split_agent_id)?.name;

  async function run(key: string, fn: () => PromiseLike<{ error: unknown }>, msg: string) {
    setBusy(key);
    setError(null);
    const { error } = await fn();
    setBusy(null);
    if (error) return setError(errMsg(error));
    toast(msg);
    router.refresh();
    onClose();
  }

  async function upload(file: File) {
    setBusy("upload");
    try {
      const sb = supabaseBrowser();
      const path = `${deal.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await sb.storage.from("deal-docs").upload(path, file);
      if (error) throw error;
      const docs = [...(deal.documents ?? []), { name: file.name, url: path }];
      const { error: e2 } = await sb.rpc("update_deal", { p_deal: deal.id, p_data: { documents: docs } });
      if (e2) throw e2;
      toast("Document uploaded");
      router.refresh();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(null); }
  }
  async function openDoc(path: string) {
    const { data } = await supabaseBrowser().storage.from("deal-docs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Sheet open onClose={onClose} wide title={`${deal.project} ${deal.unit ?? ""}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <span className="text-muted">Client</span><Link href={`/leads/${deal.lead_id}`} className="text-right font-medium text-brand">{deal.lead?.name}</Link>
          <span className="text-muted">Developer</span><span className="text-right">{deal.developer?.name ?? developers.find((d) => d.id === deal.developer_id)?.name ?? "—"}</span>
          <span className="text-muted">Sale value</span><span className="tabular text-right">{aed(deal.sale_value)}</span>
          <span className="text-muted">Commission</span><span className="tabular text-right font-semibold text-success">{aed(deal.commission_amount)} ({deal.commission_pct}%)</span>
          <span className="text-muted">Agent</span><span className="text-right">{deal.agent?.name}{splitName ? ` · ${splitName} ${deal.split_pct}%` : ""}</span>
          <span className="text-muted">Booked via</span><span className="text-right">{deal.booked_via}</span>
          <span className="text-muted">Booking date</span><span className="text-right">{fmtDate(deal.booking_date, { day: "numeric", month: "short", year: "numeric" })}</span>
          <span className="text-muted">Status</span><span className="text-right"><StatusBadge d={deal} /></span>
          {deal.received_date && <><span className="text-muted">Received</span><span className="tabular text-right">{aed(deal.received_amount)} · {fmtDate(deal.received_date)}</span></>}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-semibold">Documents</p>
          <div className="space-y-1.5">
            {(deal.documents ?? []).length === 0 && <p className="text-[12px] text-muted">Booking form, SPA, commission invoice</p>}
            {(deal.documents ?? []).map((d) => (
              <button key={d.url} onClick={() => openDoc(d.url)} className="flex items-center gap-2 text-[13px] text-brand"><Paperclip className="size-4" />{d.name}</button>
            ))}
          </div>
          {canEdit && (
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-bg">
              <FileUp className="size-4" /> {busy === "upload" ? "Uploading…" : "Upload document"}
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          )}
        </div>

        {canEdit && deal.commission_status === "pending" && (
          <div className="flex items-end gap-2">
            <Field label="Expected commission date"><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
            <Button variant="secondary" loading={busy === "exp"} onClick={() => run("exp", () => supabaseBrowser().rpc("update_deal", { p_deal: deal.id, p_data: { expected_commission_date: expected } }), "Saved")}>Save</Button>
          </div>
        )}

        {isFounder && !deal.cancelled && deal.commission_status === "pending" && (
          <div className="space-y-2 rounded-xl border border-success/30 bg-success-50/50 p-3">
            <p className="text-[13px] font-semibold">Mark commission received</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Received date"><Input type="date" value={recDate} onChange={(e) => setRecDate(e.target.value)} /></Field>
              <Field label="Amount (AED)"><Input inputMode="decimal" value={recAmount} onChange={(e) => setRecAmount(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
            </div>
            <Button variant="success" loading={busy === "rec"} onClick={() => run("rec", () => supabaseBrowser().rpc("mark_commission_received", { p_deal: deal.id, p_date: recDate, p_amount: Number(recAmount) }), "Commission marked received")}>Mark received</Button>
          </div>
        )}

        {isFounder && !deal.cancelled && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-[12px] text-muted">Booking cancelled? Lead returns to</span>
            <Select className="w-40" id="ret" defaultValue="negotiation">
              <option value="negotiation">Negotiation</option>
              <option value="lost">Lost</option>
            </Select>
            <Button variant="danger" size="sm" loading={busy === "cancel"} onClick={() => {
              if (!confirm("Cancel this deal? Commission is removed from all totals.")) return;
              const to = (document.getElementById("ret") as HTMLSelectElement).value;
              run("cancel", () => supabaseBrowser().rpc("cancel_deal", { p_deal: deal.id, p_return_stage: to }), "Deal cancelled");
            }}>Cancel deal</Button>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
