import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getIntegrations, GRAPH } from "@/lib/server/integrations";
import { leadFromFields } from "@/lib/server/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Meta verification handshake
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const { meta_verify_token } = await getIntegrations();
  if (p.get("hub.mode") === "subscribe" && meta_verify_token && p.get("hub.verify_token") === meta_verify_token) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const cfg = await getIntegrations();
  const secret = cfg.meta_app_secret;
  if (secret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return new NextResponse("Bad signature", { status: 401 });
    }
  }
  const token = cfg.meta_page_token;
  if (!token) return NextResponse.json({ error: "Meta Page access token not set (Settings → Integrations)" }, { status: 500 });

  const body = JSON.parse(raw || "{}");
  const admin = supabaseAdmin();
  const results: unknown[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;
      const res = await fetch(`${GRAPH}/${leadgenId}?fields=field_data,campaign_name,ad_name,form_id,created_time&access_token=${encodeURIComponent(token)}`);
      if (!res.ok) { results.push({ leadgenId, error: await res.text() }); continue; }
      const lead = await res.json();
      const { name, phone, email, extras } = leadFromFields(lead.field_data ?? []);
      const { data, error } = await admin.rpc("ingest_meta_lead", {
        p_name: name, p_phone: phone, p_email: email || null,
        p_campaign: lead.campaign_name ?? change.value?.campaign_id ?? null, p_ad_name: lead.ad_name ?? null, p_note: extras || null,
      });
      results.push(error ? { leadgenId, error: error.message } : data);
    }
  }
  return NextResponse.json({ ok: true, results });
}
