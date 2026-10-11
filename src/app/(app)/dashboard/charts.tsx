"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { STAGE_META } from "@/lib/constants";
import { aed, fmtDate, num } from "@/lib/format";
import type { Stage } from "@/lib/types";

const EARNED = "#2563eb";
const RECEIVED = "#0e9f8f";
const AXIS = { fontSize: 11, fill: "#6b7280" };

function Tip({ active, payload, label, money }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tabular font-medium text-ink">{money ? aed(p.value) : num(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Pipeline funnel: one horizontal bar per stage, coloured by the stage chip colour (identity). */
export function Funnel({ data }: { data: { stage: Stage; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.stage} className="grid grid-cols-[88px_1fr_36px] items-center gap-2 text-[13px]">
          <span className="text-muted">{STAGE_META[d.stage].label}</span>
          <div className="h-5 rounded-r bg-bg">
            <div className="h-full rounded-r transition-all" style={{ width: `${(d.count / max) * 100}%`, minWidth: d.count ? 4 : 0, background: STAGE_META[d.stage].color }} title={`${STAGE_META[d.stage].label}: ${d.count}`} />
          </div>
          <span className="tabular text-right font-medium">{num(d.count)}</span>
        </div>
      ))}
    </div>
  );
}

export function CommissionChart({ data }: { data: { month: string; earned: number; received: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: fmtDate(d.month, { month: "short", year: "2-digit" }), earned: Number(d.earned), received: Number(d.received) }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barGap={2} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => aed(v, true).replace("AED ", "")} />
          <Tooltip content={<Tip money />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#6b7280" }} />
          <Bar dataKey="earned" name="Earned" fill={EARNED} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="received" name="Received" fill={RECEIVED} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceChart({ data }: { data: { label: string; leads: number; won: number }[] }) {
  const rows = data.slice(0, 8).map((d) => ({ ...d, label: d.label.length > 16 ? d.label.slice(0, 15) + "…" : d.label }));
  return (
    <div style={{ height: Math.max(140, rows.length * 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" barGap={2} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#eef0f3" />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={AXIS} axisLine={false} tickLine={false} width={100} />
          <Tooltip content={<Tip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#6b7280" }} />
          <Bar dataKey="leads" name="Leads" fill={EARNED} radius={[0, 4, 4, 0]} maxBarSize={14} />
          <Bar dataKey="won" name="Won" fill={RECEIVED} radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
