"use client";

import { ArrowDown, ArrowUp, KeyRound, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useActions } from "@/components/actions";
import { Avatar, Badge, Button, Card, ErrorText, Field, Input, PageHeader, Select, Sheet } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { createAgent, resetPassword, setAccess } from "./actions";

export function TeamView({ team, openLeads }: { team: Profile[]; openLeads: Record<string, number> }) {
  const router = useRouter();
  const { toast, profile: me } = useActions();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const agents = team.filter((t) => t.role === "agent").sort((a, b) => a.round_robin_order - b.round_robin_order);
  const founders = team.filter((t) => t.role === "founder");

  const update = (id: string, patch: Partial<Profile>) => start(async () => {
    const { error } = await supabaseBrowser().from("profiles").update(patch).eq("id", id);
    if (error) toast(error.message, "error"); else router.refresh();
  });

  const move = (i: number, dir: -1 | 1) => start(async () => {
    const a = agents[i], b = agents[i + dir];
    if (!a || !b) return;
    const sb = supabaseBrowser();
    await sb.from("profiles").update({ round_robin_order: b.round_robin_order }).eq("id", a.id);
    await sb.from("profiles").update({ round_robin_order: a.round_robin_order === b.round_robin_order ? a.round_robin_order + dir : a.round_robin_order }).eq("id", b.id);
    router.refresh();
  });

  async function redistribute(p: Profile) {
    if (!confirm(`Send all ${openLeads[p.id] ?? 0} open leads of ${p.name} back through round robin?`)) return;
    const sb = supabaseBrowser();
    const { data } = await sb.from("leads").select("id").eq("owner_id", p.id).not("stage", "in", "(won,lost)");
    const ids = (data ?? []).map((d: { id: string }) => d.id);
    if (!ids.length) return;
    const { error } = await sb.rpc("recycle_round_robin", { p_leads: ids });
    if (error) toast(error.message, "error"); else { toast(`${ids.length} leads redistributed`); router.refresh(); }
  }

  async function pw(p: Profile) {
    const v = prompt(`New password for ${p.name} (8+ characters)`);
    if (!v) return;
    const r = await resetPassword(p.id, v);
    if (r.error) toast(r.error, "error"); else toast("Password updated");
  }

  async function access(p: Profile, active: boolean) {
    if (!active && !confirm(`Remove ${p.name}'s access? Their leads stay assigned until you redistribute them.`)) return;
    const r = await setAccess(p.id, active);
    if (r.error) toast(r.error, "error"); else { toast(active ? "Access restored" : "Access removed"); router.refresh(); }
  }

  const Row = ({ p, i }: { p: Profile; i?: number }) => (
    <div className="flex flex-wrap items-center gap-3 px-3 py-3.5">
      {i !== undefined && (
        <div className="flex flex-col">
          <button disabled={i === 0 || pending} onClick={() => move(i, -1)} className="text-muted disabled:opacity-30" aria-label="Move up"><ArrowUp className="size-4" /></button>
          <button disabled={i === agents.length - 1 || pending} onClick={() => move(i, 1)} className="text-muted disabled:opacity-30" aria-label="Move down"><ArrowDown className="size-4" /></button>
        </div>
      )}
      <Avatar name={p.name} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">{p.name}
          {!p.active && <Badge tone="danger">No access</Badge>}
          {p.on_leave && <Badge tone="warning">On leave</Badge>}
        </p>
        <p className="break-all text-[12px] text-muted">{p.email}{p.phone ? ` · ${p.phone}` : ""} · {openLeads[p.id] ?? 0} open leads</p>
      </div>
      <div className="flex w-full flex-wrap gap-1.5 pl-11 sm:w-auto sm:pl-0">
        {p.role === "agent" && p.active && (
          <Button size="sm" variant={p.on_leave ? "primary" : "secondary"} onClick={() => update(p.id, { on_leave: !p.on_leave })}>{p.on_leave ? "Back from leave" : "Mark on leave"}</Button>
        )}
        {!!openLeads[p.id] && p.id !== me.id && <Button size="sm" variant="secondary" onClick={() => redistribute(p)}>Redistribute leads</Button>}
        <Button size="sm" variant="ghost" onClick={() => pw(p)} title="Reset password"><KeyRound className="size-4" /></Button>
        {p.id !== me.id && (p.active
          ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => access(p, false)}>Remove</Button>
          : <Button size="sm" variant="secondary" onClick={() => access(p, true)}>Restore</Button>)}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 md:px-8 md:py-8">
      <PageHeader title="Team" sub="Round robin gives company leads to active agents in this order. Agents on leave are skipped."
        actions={<Button onClick={() => setAdding(true)}><UserPlus className="size-4" /> Add agent</Button>} />
      <h2 className="mb-2 text-[13px] font-semibold text-muted">Sales agents · round robin order</h2>
      <Card className="divide-y divide-line">
        {agents.length === 0 && <p className="p-4 text-[13px] text-muted">No agents yet. Add your first agent — they sign in with email or phone and the password you set.</p>}
        {agents.map((p, i) => <Row key={p.id} p={p} i={i} />)}
      </Card>
      <h2 className="mb-2 mt-6 text-[13px] font-semibold text-muted">Founder</h2>
      <Card className="divide-y divide-line">{founders.map((p) => <Row key={p.id} p={p} />)}</Card>
      {adding && <AddAgentSheet onClose={() => setAdding(false)} onDone={() => { setAdding(false); toast("Agent added"); router.refresh(); }} />}
    </div>
  );
}

function AddAgentSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", role: "agent" as "agent" | "founder" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const gen = () => setF({ ...f, password: Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6).toUpperCase() + "!" });
  return (
    <Sheet open onClose={onClose} title="Add agent"
      footer={<Button className="w-full" size="lg" loading={pending} onClick={() => start(async () => { const r = await createAgent(f); if (r.error) setError(r.error); else onDone(); })}>Create login</Button>}>
      <div className="space-y-3">
        <Field label="Name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email" required><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Mobile" hint="Lets them sign in with their phone number"><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+971 50 123 4567" /></Field>
        <Field label="Temporary password" required hint="Share it with the agent on WhatsApp">
          <div className="flex gap-2"><Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><Button variant="secondary" onClick={gen}>Generate</Button></div>
        </Field>
        <Field label="Role">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "agent" | "founder" })}>
            <option value="agent">Sales agent</option>
            <option value="founder">Founder / admin</option>
          </Select>
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
