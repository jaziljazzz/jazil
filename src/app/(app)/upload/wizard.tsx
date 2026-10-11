"use client";

import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Badge, Button, Card, cn, ErrorText, Field, Input, PageHeader, Select } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { aed, errMsg, fmtDate, num } from "@/lib/format";
import type { Profile } from "@/lib/types";

const TARGETS = [
  { key: "name", label: "Name", required: true, match: /^(full\s*)?name|client|customer|contact/i },
  { key: "phone", label: "Phone", required: true, match: /phone|mobile|cell|whats|number|contact\s*no/i },
  { key: "email", label: "Email", match: /e-?mail/i },
  { key: "nationality", label: "Nationality", match: /national|country/i },
  { key: "note", label: "Notes", match: /note|comment|remark|interest|requirement/i },
] as const;
type Key = (typeof TARGETS)[number]["key"];

function normalizePhone(p: string) {
  let d = String(p ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (!d.startsWith("+")) {
    d = d.replace(/\D/g, "");
    if (d.startsWith("05") && d.length === 10) d = "+971" + d.slice(1);
    else if (d.startsWith("5") && d.length === 9) d = "+971" + d;
    else d = "+" + d;
  } else d = "+" + d.slice(1).replace(/\D/g, "");
  return d.length >= 9 && d.length <= 16 ? d : null;
}

export function UploadWizard({ team, batches }: { team: Profile[]; batches: { id: string; name: string; vendor: string | null; cost: number | null; uploaded_at: string; total_rows: number; imported: number; duplicates: number; invalid: number }[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [map, setMap] = useState<Record<Key, string>>({ name: "", phone: "", email: "", nationality: "", note: "" });
  const [batch, setBatch] = useState({ vendor: "", date: new Date().toISOString().slice(0, 10), cost: "" });
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<null | { imported: number; duplicates: number; invalid: number; split: Record<string, number>; duplicate_rows: { name: string; phone: string }[]; invalid_rows: { name: string; phone: string }[] }>(null);

  async function onFile(file: File) {
    setError(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
      if (!data.length) throw new Error("The sheet is empty");
      const hs = Object.keys(data[0]!);
      const auto = { name: "", phone: "", email: "", nationality: "", note: "" } as Record<Key, string>;
      TARGETS.forEach((t) => { auto[t.key] = hs.find((h) => t.match.test(h) && !Object.values(auto).includes(h)) ?? ""; });
      setFileName(file.name);
      setHeaders(hs);
      setRows(data);
      setMap(auto);
      if (!batch.vendor) setBatch((b) => ({ ...b, vendor: file.name.replace(/\.(xlsx|xls|csv)$/i, "") }));
      setStep(2);
    } catch (e) { setError(errMsg(e)); }
  }

  const prepared = useMemo(() => rows.map((r) => ({
    name: String(r[map.name] ?? "").trim(),
    phone: String(r[map.phone] ?? "").trim(),
    email: map.email ? String(r[map.email] ?? "").trim() : "",
    nationality: map.nationality ? String(r[map.nationality] ?? "").trim() : "",
    note: map.note ? String(r[map.note] ?? "").trim() : "",
    norm: normalizePhone(String(r[map.phone] ?? "")),
  })), [rows, map]);

  const analysis = useMemo(() => {
    const seen = new Set<string>();
    let valid = 0, dup = 0, invalid = 0;
    const status = prepared.map((p) => {
      if (!p.name || !p.norm) { invalid++; return "invalid"; }
      if (existing.has(p.norm) || seen.has(p.norm)) { dup++; return "duplicate"; }
      seen.add(p.norm); valid++; return "valid";
    });
    return { valid, dup, invalid, status };
  }, [prepared, existing]);

  const agents = team.filter((t) => t.role === "agent" && t.active && !t.on_leave);
  const perAgent = agents.length ? Math.floor(analysis.valid / agents.length) : 0;
  const extra = agents.length ? analysis.valid % agents.length : 0;

  async function toPreview() {
    setBusy(true);
    const phones = Array.from(new Set(prepared.map((p) => p.norm).filter(Boolean))) as string[];
    const found = new Set<string>();
    const sb = supabaseBrowser();
    for (let i = 0; i < phones.length; i += 300) {
      const { data } = await sb.from("leads").select("phone").in("phone", phones.slice(i, i + 300));
      (data ?? []).forEach((d: { phone: string }) => found.add(d.phone));
    }
    setExisting(found);
    setBusy(false);
    setStep(3);
  }

  async function importNow() {
    setBusy(true);
    setError(null);
    try {
      const payload = prepared.map(({ norm: _n, ...p }) => p);
      const name = `${batch.vendor || "Batch"} · ${fmtDate(batch.date, { day: "numeric", month: "short", year: "numeric" })}`;
      const sb = supabaseBrowser();
      const total = { imported: 0, duplicates: 0, invalid: 0, split: {} as Record<string, number>, duplicate_rows: [] as { name: string; phone: string }[], invalid_rows: [] as { name: string; phone: string }[] };
      let batchId: string | null = null;
      for (let i = 0; i < payload.length; i += 400) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error }: { data: any; error: unknown } = await sb.rpc("import_batch", { p_name: name, p_vendor: batch.vendor || null, p_cost: batch.cost ? Number(batch.cost) : null, p_rows: payload.slice(i, i + 400), p_batch: batchId });
        if (error) throw error;
        batchId = data.batch_id;
        total.imported += data.imported;
        total.duplicates += data.duplicates;
        total.invalid += data.invalid;
        total.duplicate_rows.push(...data.duplicate_rows);
        total.invalid_rows.push(...data.invalid_rows);
        Object.entries(data.split as Record<string, number>).forEach(([k, v]) => { total.split[k] = (total.split[k] ?? 0) + v; });
        setProgress(Math.min(payload.length, i + 400));
      }
      setReport(total);
      setStep(4);
      router.refresh();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  const names = Object.fromEntries(team.map((t) => [t.id, t.name]));
  const steps = ["Upload file", "Map columns", "Preview & confirm", "Report"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 md:px-8 md:py-8">
      <PageHeader title="Upload leads" sub="Bought lists are de-duplicated by phone and split equally across active agents" />
      <ol className="mb-5 flex gap-2 text-[12px]">
        {steps.map((s, i) => (
          <li key={s} className={cn(step === i + 1 ? "flex-[3]" : "flex-1", "whitespace-nowrap rounded-full px-3 py-1.5 text-center font-medium", step === i + 1 ? "bg-brand text-white" : step > i + 1 ? "bg-brand-50 text-brand" : "bg-black/5 text-muted")}>
            <span className={step === i + 1 ? "" : "hidden sm:inline"}>{i + 1}. </span><span className={step === i + 1 ? "" : "hidden sm:inline"}>{s}</span><span className={step === i + 1 ? "hidden" : "sm:hidden"}>{i + 1}</span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Card className="p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Vendor / batch name" required><Input value={batch.vendor} onChange={(e) => setBatch({ ...batch, vendor: e.target.value })} placeholder="PropertyLeads Co." /></Field>
            <Field label="Date"><Input type="date" value={batch.date} onChange={(e) => setBatch({ ...batch, date: e.target.value })} /></Field>
            <Field label="Batch cost (AED)" hint="Optional, for cost per deal"><Input inputMode="numeric" value={batch.cost} onChange={(e) => setBatch({ ...batch, cost: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
          </div>
          <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-6 py-10 text-center hover:border-brand/50 hover:bg-brand-50/30">
            <Upload className="size-7 text-brand" />
            <span className="text-[14px] font-medium">Choose an Excel or CSV file</span>
            <span className="text-[12px] text-muted">.xlsx, .xls or .csv · first sheet is used</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <div className="mt-3"><ErrorText>{error}</ErrorText></div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 text-[13px]"><FileSpreadsheet className="size-4 text-success" />{fileName} · {num(rows.length)} rows</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TARGETS.map((t) => (
              <Field key={t.key} label={t.label} required={"required" in t && t.required}>
                <Select value={map[t.key]} onChange={(e) => setMap({ ...map, [t.key]: e.target.value })}>
                  <option value="">— not in file —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </Field>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full whitespace-nowrap text-[12px]">
              <thead className="bg-bg text-left text-muted"><tr>{TARGETS.map((t) => <th key={t.key} className="px-2 py-1.5 font-medium">{t.label}</th>)}</tr></thead>
              <tbody>{prepared.slice(0, 5).map((p, i) => <tr key={i} className="border-t border-line">{TARGETS.map((t) => <td key={t.key} className="max-w-48 truncate px-2 py-1.5">{p[t.key]}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button disabled={!map.name || !map.phone} loading={busy} onClick={toPreview}>Preview</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-5">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-success-50 p-3"><div className="tabular text-[24px] font-semibold text-success">{num(analysis.valid)}</div><div className="text-[12px] text-muted">Valid, will import</div></div>
            <div className="rounded-xl bg-warning-50 p-3"><div className="tabular text-[24px] font-semibold text-warning">{num(analysis.dup)}</div><div className="text-[12px] text-muted">Duplicates (skipped)</div></div>
            <div className="rounded-xl bg-danger-50 p-3"><div className="tabular text-[24px] font-semibold text-danger">{num(analysis.invalid)}</div><div className="text-[12px] text-muted">Invalid phone / name</div></div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[13px] font-semibold">Split per agent (round robin)</p>
            {agents.length === 0 ? (
              <p className="rounded-lg bg-warning-50 px-3 py-2 text-[13px] text-warning">No active agents — leads will be assigned to you. Add agents in Team first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {agents.map((a, i) => <span key={a.id} className="rounded-full border border-line px-3 py-1 text-[13px]">{a.name} · <span className="tabular font-semibold">~{perAgent + (i < extra ? 1 : 0)}</span></span>)}
              </div>
            )}
            {team.some((t) => t.on_leave) && <p className="mt-1 text-[12px] text-muted">Agents on leave are skipped.</p>}
          </div>
          <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-line">
            <table className="w-full whitespace-nowrap text-[12px]">
              <thead className="sticky top-0 bg-bg text-left text-muted"><tr><th className="px-2 py-1.5 font-medium">Name</th><th className="px-2 py-1.5 font-medium">Phone</th><th className="px-2 py-1.5 font-medium">Status</th></tr></thead>
              <tbody>
                {prepared.slice(0, 300).map((p, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-2 py-1.5">{p.name || <span className="text-danger">missing</span>}</td>
                    <td className="tabular px-2 py-1.5">{p.norm ?? p.phone}</td>
                    <td className="px-2 py-1.5"><Badge tone={analysis.status[i] === "valid" ? "success" : analysis.status[i] === "duplicate" ? "warning" : "danger"}>{analysis.status[i]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3"><ErrorText>{error}</ErrorText></div>
          <div className="mt-4 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button disabled={!analysis.valid} loading={busy} onClick={importNow}>{busy && progress ? `Importing ${num(progress)} / ${num(prepared.length)}…` : `Import ${num(analysis.valid)} leads`}</Button>
          </div>
        </Card>
      )}

      {step === 4 && report && (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[16px] font-semibold text-success"><CheckCircle2 className="size-5" /> Imported {num(report.imported)} leads</div>
          <p className="mt-1 text-[13px] text-muted">{report.duplicates} duplicates skipped (existing leads got a &quot;came in again&quot; note) · {report.invalid} invalid</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(report.split).map(([id, n]) => <span key={id} className="rounded-full border border-line px-3 py-1 text-[13px]">{names[id] ?? "—"} · <span className="tabular font-semibold">{n}</span></span>)}
          </div>
          {report.duplicate_rows.length > 0 && (
            <details className="mt-3 text-[12px]"><summary className="cursor-pointer font-medium">Duplicate rows ({report.duplicate_rows.length})</summary>
              <ul className="mt-1 max-h-48 overflow-auto text-muted">{report.duplicate_rows.map((r, i) => <li key={i}>{r.name} · {r.phone}</li>)}</ul></details>
          )}
          {report.invalid_rows.length > 0 && (
            <details className="mt-2 text-[12px]"><summary className="cursor-pointer font-medium">Invalid rows ({report.invalid_rows.length})</summary>
              <ul className="mt-1 max-h-48 overflow-auto text-muted">{report.invalid_rows.map((r, i) => <li key={i}>{r.name || "(no name)"} · {r.phone}</li>)}</ul></details>
          )}
          <Button className="mt-4" onClick={() => { setStep(1); setRows([]); setReport(null); setFileName(""); }}>Upload another file</Button>
        </Card>
      )}

      {batches.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-[16px] font-semibold">Recent batches</h2>
          <div className="overflow-x-auto rounded-[12px] border border-line bg-surface">
            <table className="w-full whitespace-nowrap text-[13px]">
              <thead className="border-b border-line bg-bg/60 text-left text-[12px] text-muted"><tr>{["Batch", "Uploaded", "Rows", "Imported", "Duplicates", "Invalid", "Cost"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="tabular">
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium">{b.name}</td><td className="px-3 py-2 text-muted">{fmtDate(b.uploaded_at)}</td>
                    <td className="px-3 py-2">{b.total_rows}</td><td className="px-3 py-2 text-success">{b.imported}</td><td className="px-3 py-2">{b.duplicates}</td><td className="px-3 py-2">{b.invalid}</td>
                    <td className="px-3 py-2">{b.cost ? aed(b.cost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
