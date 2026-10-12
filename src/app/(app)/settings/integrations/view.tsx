"use client";

import { CheckCircle2, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useActions } from "@/components/actions";
import { Button, Card, ErrorText, Field, Input, PageHeader, SectionTitle } from "@/components/ui";
import { connectMeta, saveIntegrations, testWhatsApp } from "./actions";

type Init = {
  meta_page_id: string; meta_page_token_set: string; meta_app_secret_set: string; meta_verify_token: string;
  wa_enabled: boolean; wa_token_set: string; wa_phone_number_id: string; wa_template_morning: string; wa_template_evening: string; wa_lang: string;
};

function Copyable({ value }: { value: string }) {
  const { toast } = useActions();
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(value); toast("Copied"); }}
      className="flex w-full items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2.5 text-left text-[12px]">
      <code className="break-all">{value}</code><Copy className="size-4 shrink-0 text-muted" />
    </button>
  );
}

export function IntegrationsView({ origin, initial }: { origin: string; initial: Init }) {
  const router = useRouter();
  const { toast } = useActions();
  const [pending, start] = useTransition();
  const [meta, setMeta] = useState({ meta_page_id: initial.meta_page_id, meta_page_token: "", meta_app_secret: "" });
  const [wa, setWa] = useState({ wa_enabled: initial.wa_enabled, wa_token: "", wa_phone_number_id: initial.wa_phone_number_id, wa_template_morning: initial.wa_template_morning, wa_template_evening: initial.wa_template_evening, wa_lang: initial.wa_lang });
  const [msg, setMsg] = useState<{ meta?: string; wa?: string; metaErr?: string; waErr?: string }>({});

  const save = (patch: Record<string, string | boolean | null>, then?: () => Promise<{ ok?: boolean; message?: string; error?: string }>, key?: "meta" | "wa") =>
    start(async () => {
      const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== ""));
      const r = await saveIntegrations(cleaned);
      if (r.error) return toast(r.error, "error");
      toast("Saved");
      router.refresh();
      if (then && key) {
        const t = await then();
        setMsg((m) => ({ ...m, [key]: t.message, [`${key}Err`]: t.error }));
      }
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-3 md:px-8 md:py-8">
      <PageHeader title="Integrations" sub="Connect Meta lead ads and WhatsApp. Keys are stored securely and only the founder can see this page." />

      <Card className="p-4">
        <SectionTitle>Meta Lead Ads (Facebook & Instagram forms)</SectionTitle>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-[13px] text-ink/80">
          <li>In <b>developers.facebook.com</b> create an app (type Business) and add the <b>Webhooks</b> product.</li>
          <li>Webhooks → <b>Page</b> → Subscribe to <b>leadgen</b> with this callback URL and verify token:</li>
        </ol>
        <div className="space-y-2">
          <Field label="Callback URL"><Copyable value={`${origin}/api/meta/webhook`} /></Field>
          <Field label="Verify token"><Copyable value={initial.meta_verify_token} /></Field>
        </div>
        <ol start={3} className="my-4 list-decimal space-y-1 pl-5 text-[13px] text-ink/80">
          <li>In Graph API Explorer, get a <b>Page access token</b> (permissions: leads_retrieval, pages_manage_metadata, pages_show_list) and make it long-lived.</li>
          <li>Paste the Page ID, token and the app secret below, then press <b>Save & connect</b>.</li>
        </ol>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Facebook Page ID"><Input value={meta.meta_page_id} onChange={(e) => setMeta({ ...meta, meta_page_id: e.target.value })} placeholder="1234567890" /></Field>
          <Field label="App secret" hint={initial.meta_app_secret_set ? `Saved ${initial.meta_app_secret_set}` : "Verifies that webhooks really come from Meta"}>
            <Input type="password" value={meta.meta_app_secret} onChange={(e) => setMeta({ ...meta, meta_app_secret: e.target.value })} placeholder={initial.meta_app_secret_set || "App secret"} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Page access token" hint={initial.meta_page_token_set ? `Saved ${initial.meta_page_token_set}` : undefined}>
              <Input type="password" value={meta.meta_page_token} onChange={(e) => setMeta({ ...meta, meta_page_token: e.target.value })} placeholder={initial.meta_page_token_set || "EAAG…"} />
            </Field>
          </div>
        </div>
        {msg.meta && <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-[13px] text-success"><CheckCircle2 className="size-4" />{msg.meta}</p>}
        <div className="mt-3"><ErrorText>{msg.metaErr}</ErrorText></div>
        <Button className="mt-3" loading={pending} onClick={() => save(meta, connectMeta, "meta")}>Save & connect</Button>
      </Card>

      <Card className="p-4">
        <SectionTitle>WhatsApp summaries (WhatsApp Cloud API)</SectionTitle>
        <p className="text-[13px] text-ink/80">
          Sends the 9 AM summary to each agent and the 7 PM team summary to you on WhatsApp. This needs a WhatsApp Business <b>API</b> number
          (Meta WhatsApp Manager), not the WhatsApp Business app. The in-app and phone notifications work without this.
        </p>
        <div className="mt-3 rounded-lg bg-bg p-3 text-[12px] text-ink/80">
          <p className="font-semibold">Create two Utility templates in WhatsApp Manager:</p>
          <p className="mt-1"><b>aventus_morning_summary</b>: Good morning {"{{1}}"}. Today: {"{{2}}"} overdue, {"{{3}}"} due today, {"{{4}}"} new untouched leads. Open the CRM to start calling.</p>
          <p className="mt-1"><b>aventus_team_summary</b>: Team summary for {"{{1}}"}: {"{{2}}"}</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Phone number ID"><Input value={wa.wa_phone_number_id} onChange={(e) => setWa({ ...wa, wa_phone_number_id: e.target.value })} /></Field>
          <Field label="Permanent access token" hint={initial.wa_token_set ? `Saved ${initial.wa_token_set}` : "System user token with whatsapp_business_messaging"}>
            <Input type="password" value={wa.wa_token} onChange={(e) => setWa({ ...wa, wa_token: e.target.value })} placeholder={initial.wa_token_set || "EAAG…"} />
          </Field>
          <Field label="Morning template name"><Input value={wa.wa_template_morning} onChange={(e) => setWa({ ...wa, wa_template_morning: e.target.value })} /></Field>
          <Field label="Evening template name"><Input value={wa.wa_template_evening} onChange={(e) => setWa({ ...wa, wa_template_evening: e.target.value })} /></Field>
          <Field label="Template language code"><Input value={wa.wa_lang} onChange={(e) => setWa({ ...wa, wa_lang: e.target.value })} placeholder="en" /></Field>
          <label className="flex items-end gap-2 pb-2.5 text-[14px]">
            <input type="checkbox" className="size-5 accent-brand" checked={wa.wa_enabled} onChange={(e) => setWa({ ...wa, wa_enabled: e.target.checked })} />
            Send WhatsApp summaries
          </label>
        </div>
        {msg.wa && <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-[13px] text-success"><CheckCircle2 className="size-4" />{msg.wa}</p>}
        <div className="mt-3"><ErrorText>{msg.waErr}</ErrorText></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button loading={pending} onClick={() => save(wa)}>Save</Button>
          <Button variant="secondary" loading={pending} onClick={() => save(wa, testWhatsApp, "wa")}>Save & send me a test</Button>
        </div>
      </Card>
    </div>
  );
}
