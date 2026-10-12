"use client";

import { Check, ChevronDown, Copy, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useActions } from "@/components/actions";
import { WhatsAppIcon } from "@/components/lead-card";
import { Button, cn, ErrorText, Field, Input } from "@/components/ui";
import { fmtDateTime, relative } from "@/lib/format";
import { disconnectMetaAction, disconnectWhatsApp, pickMetaPage, saveMetaApp, saveWhatsApp, syncMetaLeads, testWhatsAppAction } from "./actions";

type Meta = { appReady: boolean; appId: string; configId: string; secretSaved: boolean; connected: boolean; pageName: string | null; pageId: string | null; userName: string | null; connectedAt: string | null; lastSync: string | null; pending: { id: string; name: string }[] };
type Wa = { connected: boolean; tokenSaved: boolean; phoneNumberId: string; enabled: boolean; morning: string; evening: string; lang: string };
type Key = "meta" | "whatsapp";

function MetaLogo({ className }: { className?: string }) {
  return (
    <span className={cn("grid place-items-center rounded-xl bg-gradient-to-br from-[#0668E1] to-[#0081FB]", className)}>
      <svg viewBox="0 0 36 24" className="w-[62%] fill-none stroke-white" strokeWidth="3.4" strokeLinecap="round" aria-hidden="true">
        <path d="M3 17c0-6 3-12 7-12 5 0 8 14 13 14 3 0 4-3 4-6 0-5-3-9-6-9-4 0-7 6-9 9-2 3-4 6-6 6-2 0-3-1-3-2z" />
      </svg>
    </span>
  );
}
function WaLogo({ className }: { className?: string }) {
  return <span className={cn("grid place-items-center rounded-xl bg-[#25D366] text-white", className)}><WhatsAppIcon className="w-[58%]" /></span>;
}

const SOON = [
  { name: "Property Finder", desc: "Import enquiries from Property Finder listings", tone: "#E11D48" },
  { name: "Bayut & Dubizzle", desc: "Import enquiries from Bayut and Dubizzle", tone: "#16A34A" },
  { name: "Google Sheets", desc: "Sync leads from a shared sheet", tone: "#0F9D58" },
];

export function ConnectorsView({ flash, meta, wa }: { flash: { open?: string; error?: string; connected: boolean; pick: boolean }; meta: Meta; wa: Wa }) {
  const [open, setOpen] = useState<Key | null>((flash.open as Key) ?? null);
  const router = useRouter();
  useEffect(() => { if (flash.open || flash.error) router.replace("/connectors", { scroll: false }); /* clean the URL */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards: { key: Key; name: string; by: string; desc: string; logo: ReactNode; connected: boolean; detail?: string }[] = [
    { key: "meta", name: "Meta Lead Ads", by: "Facebook & Instagram", desc: "New lead form submissions arrive instantly and are assigned by round robin.", logo: <MetaLogo className="size-11" />, connected: meta.connected, detail: meta.pageName ?? undefined },
    { key: "whatsapp", name: "WhatsApp summaries", by: "WhatsApp Business Platform", desc: "9 AM agent summaries and the 7 PM team summary on WhatsApp.", logo: <WaLogo className="size-11" />, connected: wa.connected },
  ];

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 md:px-8 md:py-8">
      <div className="mb-5">
        <h1 className="hidden text-[22px] font-semibold md:block">Connectors</h1>
        <p className="mt-1 text-[14px] text-muted">Connect Aventus CRM to the tools your team already uses.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {cards.map((c, i) => (
          <button key={c.key} onClick={() => setOpen(c.key)} className={cn("flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-bg", i > 0 && "border-t border-line")}>
            {c.logo}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{c.name}</p>
              <p className="text-[13px] text-muted">{c.connected && c.detail ? `Connected to ${c.detail}` : c.desc}</p>
            </div>
            {c.connected ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[12px] font-medium text-success"><span className="size-1.5 rounded-full bg-success" />Connected</span>
            ) : (
              <span className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium">Connect</span>
            )}
          </button>
        ))}
      </div>

      <p className="mb-2 mt-7 px-1 text-[12px] font-semibold uppercase tracking-wide text-muted">Coming soon</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface opacity-70">
        {SOON.map((c, i) => (
          <div key={c.name} className={cn("flex items-center gap-4 p-4", i > 0 && "border-t border-line")}>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl text-[16px] font-bold text-white" style={{ background: c.tone }}>{c.name[0]}</span>
            <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">{c.name}</p><p className="text-[13px] text-muted">{c.desc}</p></div>
          </div>
        ))}
      </div>

      {open === "meta" && <MetaDialog meta={meta} flash={flash} onClose={() => setOpen(null)} />}
      {open === "whatsapp" && <WhatsAppDialog wa={wa} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Claude-style connector dialog shell. */
function Dialog({ logo, title, by, onClose, children, footer }: { logo: ReactNode; title: string; by: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl md:max-w-[520px] md:rounded-3xl">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-surface/90 text-muted shadow-sm hover:bg-bg" aria-label="Close"><X className="size-5" /></button>
        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-7">
          <div className="flex flex-col items-center text-center">
            {logo}
            <h2 className="mt-3 text-[20px] font-semibold">{title}</h2>
            <p className="text-[13px] text-muted">{by}</p>
          </div>
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="safe-bottom border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

function Permissions({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-[13px] font-semibold">Aventus CRM will be able to</p>
      <ul className="mt-2 space-y-2">
        {items.map((t) => <li key={t} className="flex gap-2.5 text-[13px] text-ink/80"><Check className="mt-0.5 size-4 shrink-0 text-success" />{t}</li>)}
      </ul>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { toast } = useActions();
  return (
    <div>
      <p className="mb-1 text-[12px] text-muted">{label}</p>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(value); toast("Copied"); }} className="flex w-full items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-left text-[12px]">
        <code className="break-all">{value}</code><Copy className="size-4 shrink-0 text-muted" />
      </button>
    </div>
  );
}

function MetaDialog({ meta, flash, onClose }: { meta: Meta; flash: { error?: string; connected: boolean; pick: boolean }; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useActions();
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState(!meta.appReady);
  const [appReady, setAppReady] = useState(meta.appReady);
  const [app, setApp] = useState({ meta_app_id: meta.appId, meta_app_secret: "", meta_login_config_id: meta.configId });
  const [error, setError] = useState<string | null>(flash.error ?? null);
  const [info, setInfo] = useState<string | null>(flash.connected ? "Connected. New Meta leads will now arrive in the CRM instantly." : null);
  const [page, setPage] = useState(meta.pending[0]?.id ?? "");
  const [redirecting, setRedirecting] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>, okMsg?: string) => start(async () => {
    setError(null);
    const r = await fn();
    if (r.error) setError(r.error); else { if (r.message || okMsg) setInfo(r.message ?? okMsg ?? null); router.refresh(); }
  });
  const connect = () => { setRedirecting(true); window.location.href = "/api/connect/meta/start"; };

  const showPicker = meta.pending.length > 0 && !meta.connected;

  const footer = meta.connected ? (
    <div className="flex flex-wrap gap-2">
      <Button className="flex-1" loading={pending} onClick={() => run(syncMetaLeads)}><RefreshCw className="size-4" /> Sync recent leads</Button>
      <Button variant="secondary" onClick={connect} disabled={redirecting}>Reconnect</Button>
    </div>
  ) : showPicker ? (
    <Button className="w-full" size="lg" disabled={!page} loading={pending} onClick={() => run(() => pickMetaPage(page), "Connected. New Meta leads will now arrive in the CRM instantly.")}>Connect this Page</Button>
  ) : (
    <button onClick={connect} disabled={!appReady || redirecting}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#1877F2] text-[15px] font-semibold text-white hover:bg-[#166FE5] disabled:opacity-40">
      {redirecting ? <Loader2 className="size-5 animate-spin" /> : <svg viewBox="0 0 24 24" className="size-5 fill-white" aria-hidden="true"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" /></svg>}
      {redirecting ? "Opening Facebook…" : "Continue with Facebook"}
    </button>
  );

  return (
    <Dialog logo={<MetaLogo className="size-16" />} title="Meta Lead Ads" by="Facebook & Instagram lead forms" onClose={onClose} footer={footer}>
      {info && <p className="mb-4 flex items-start gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-[13px] text-success"><Check className="mt-0.5 size-4 shrink-0" />{info}</p>}
      <div className="mb-4"><ErrorText>{error}</ErrorText></div>

      {meta.connected ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line">
            {[
              ["Facebook Page", meta.pageName ?? meta.pageId],
              ["Connected by", meta.userName ?? "—"],
              ["Connected", meta.connectedAt ? fmtDateTime(meta.connectedAt) : "—"],
              ["Last sync", meta.lastSync ? relative(meta.lastSync) : "Live (instant webhook)"],
            ].map(([k, v], i) => (
              <div key={k} className={cn("flex items-center justify-between gap-3 px-4 py-3 text-[13px]", i > 0 && "border-t border-line")}>
                <span className="text-muted">{k}</span><span className="text-right font-medium">{v}</span>
              </div>
            ))}
          </div>
          <Permissions items={["Receive new lead form submissions from this Page instantly", "Read the answers people give in your lead forms", "Tag each lead with its campaign and ad name"]} />
          <button onClick={() => { if (confirm("Disconnect Meta? New leads will stop arriving until you connect again.")) run(disconnectMetaAction, "Disconnected"); }} className="w-full py-2 text-[13px] font-medium text-danger">Disconnect</button>
        </div>
      ) : showPicker ? (
        <div className="space-y-2">
          <p className="mb-2 text-[13px] text-muted">Choose the Page that runs your lead ads{meta.userName ? ` (signed in as ${meta.userName})` : ""}:</p>
          {meta.pending.map((p) => (
            <label key={p.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3", page === p.id ? "border-brand bg-brand-50" : "border-line")}>
              <input type="radio" name="page" className="size-4 accent-brand" checked={page === p.id} onChange={() => setPage(p.id)} />
              <span className="text-[14px] font-medium">{p.name}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-center text-[14px] text-ink/80">Sign in with the Facebook account that manages the Aventus Page. Leads from your Facebook and Instagram lead ads will flow straight into the CRM.</p>
          <Permissions items={["See the Facebook Pages you manage", "Receive new lead form submissions instantly", "Read the answers in your lead forms", "Tag leads with campaign and ad name"]} />

          <div className="rounded-2xl border border-line">
            <button onClick={() => setSetup((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="text-[13px] font-semibold">
                One-time Meta app setup {appReady ? <span className="ml-1 font-normal text-success">· done</span> : <span className="ml-1 font-normal text-warning">· required</span>}
              </span>
              <ChevronDown className={cn("size-4 text-muted transition-transform", setup && "rotate-180")} />
            </button>
            {setup && (
              <div className="space-y-3 border-t border-line px-4 pb-4 pt-3">
                <ol className="list-decimal space-y-1.5 pl-5 text-[12px] text-ink/80">
                  <li>Open <a className="font-medium text-brand" href="https://developers.facebook.com/apps/creation/" target="_blank" rel="noreferrer">developers.facebook.com <ExternalLink className="inline size-3" /></a> → Create app → <b>Other</b> → <b>Business</b>, and link your Business portfolio.</li>
                  <li>Add <b>Facebook Login for Business</b>. Under Settings, add the redirect URI below to <b>Valid OAuth Redirect URIs</b>.</li>
                  <li>Create a login <b>Configuration</b> with the permissions leads_retrieval, pages_show_list, pages_read_engagement, pages_manage_metadata, pages_manage_ads, business_management, and copy its ID.</li>
                  <li>From App settings → Basic, copy the <b>App ID</b> and <b>App secret</b> and paste them here.</li>
                </ol>
                <CopyRow label="Valid OAuth Redirect URI" value={`${origin}/api/connect/meta/callback`} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="App ID"><Input value={app.meta_app_id} onChange={(e) => setApp({ ...app, meta_app_id: e.target.value })} placeholder="1234567890" /></Field>
                  <Field label="App secret" hint={meta.secretSaved ? "Saved ••••" : undefined}><Input type="password" value={app.meta_app_secret} onChange={(e) => setApp({ ...app, meta_app_secret: e.target.value })} placeholder={meta.secretSaved ? "Saved" : ""} /></Field>
                </div>
                <Field label="Login configuration ID" hint="From Facebook Login for Business → Configurations. Leave empty for classic Facebook Login."><Input value={app.meta_login_config_id} onChange={(e) => setApp({ ...app, meta_login_config_id: e.target.value })} /></Field>
                <Button variant="secondary" loading={pending} onClick={() => run(async () => {
                  const r = await saveMetaApp(app);
                  if (!r.error && app.meta_app_id.trim() && (app.meta_app_secret.trim() || meta.secretSaved)) { setAppReady(true); setSetup(false); }
                  return r;
                }, "Meta app saved. Now press Continue with Facebook.")}>Save app details</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function WhatsAppDialog({ wa, onClose }: { wa: Wa; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ wa_enabled: true, wa_token: "", wa_phone_number_id: wa.phoneNumberId, wa_template_morning: wa.morning, wa_template_evening: wa.evening, wa_lang: wa.lang });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>, ok?: string) => start(async () => {
    setError(null); const r = await fn();
    if (r.error) setError(r.error); else { setInfo(r.message ?? ok ?? null); router.refresh(); }
  });
  return (
    <Dialog logo={<WaLogo className="size-16" />} title="WhatsApp summaries" by="WhatsApp Business Platform (Cloud API)" onClose={onClose}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" loading={pending} onClick={() => run(async () => { const r = await saveWhatsApp(f); return r.error ? r : testWhatsAppAction(); })}>{wa.connected ? "Save & send test" : "Connect & send test"}</Button>
          {wa.connected && <Button variant="ghost" className="text-danger" onClick={() => run(disconnectWhatsApp, "Disconnected")}>Disconnect</Button>}
        </div>
      }>
      {info && <p className="mb-4 flex items-start gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-[13px] text-success"><Check className="mt-0.5 size-4 shrink-0" />{info}</p>}
      <div className="mb-4"><ErrorText>{error}</ErrorText></div>
      <div className="space-y-4">
        <Permissions items={["Send each agent their 9 AM follow-up summary", "Send you the 7 PM team summary", "Only send approved template messages"]} />
        <p className="text-[12px] text-muted">
          Needs a WhatsApp Business <b>API</b> number from Meta WhatsApp Manager (separate from the WhatsApp Business app on your phone).
          Phone notifications already deliver these summaries without this.
        </p>
        <div className="rounded-xl bg-bg p-3 text-[12px] text-ink/80">
          <p className="font-semibold">Create two Utility templates:</p>
          <p className="mt-1"><b>aventus_morning_summary</b>: Good morning {"{{1}}"}. Today: {"{{2}}"} overdue, {"{{3}}"} due today, {"{{4}}"} new untouched leads. Open the CRM to start calling.</p>
          <p className="mt-1"><b>aventus_team_summary</b>: Team summary for {"{{1}}"}: {"{{2}}"}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone number ID"><Input value={f.wa_phone_number_id} onChange={(e) => setF({ ...f, wa_phone_number_id: e.target.value })} /></Field>
          <Field label="Permanent access token" hint={wa.tokenSaved ? "Saved ••••" : undefined}><Input type="password" value={f.wa_token} onChange={(e) => setF({ ...f, wa_token: e.target.value })} placeholder={wa.tokenSaved ? "Saved" : "EAAG…"} /></Field>
          <Field label="Morning template"><Input value={f.wa_template_morning} onChange={(e) => setF({ ...f, wa_template_morning: e.target.value })} /></Field>
          <Field label="Evening template"><Input value={f.wa_template_evening} onChange={(e) => setF({ ...f, wa_template_evening: e.target.value })} /></Field>
        </div>
      </div>
    </Dialog>
  );
}


