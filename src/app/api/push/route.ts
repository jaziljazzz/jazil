import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validHook } from "@/lib/server/hook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Called by the database for every new notification: delivers it to the owner's phones. */
export async function POST(req: Request) {
  if (!validHook(req)) return new NextResponse("Forbidden", { status: 403 });
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ skipped: "VAPID keys not set" });
  webpush.setVapidDetails("mailto:crm@aventusrealtors.com", pub, priv);

  const { id } = await req.json();
  const admin = supabaseAdmin();
  const { data: n } = await admin.from("notifications").select("*").eq("id", id).single();
  if (!n) return NextResponse.json({ skipped: "not found" });
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", n.user_id);

  const payload = JSON.stringify({
    title: n.title,
    body: n.body ?? "",
    url: n.lead_id ? `/leads/${n.lead_id}` : n.kind === "summary" ? "/today" : "/notifications",
    tag: n.lead_id ?? n.kind,
  });
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }));
  return NextResponse.json({ sent });
}
