"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/** Saves this phone's push subscription for the signed-in user (a shared phone moves to the new user). */
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const admin = supabaseAdmin();
  await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await admin.from("push_subscriptions").insert({
    user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 200),
  });
  return error ? { error: error.message } : { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  await supabaseAdmin().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: true };
}

/** Sends a test notification to the signed-in user's phones (goes through the normal notification pipeline). */
export async function sendTestPush() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  await supabaseAdmin().from("notifications").insert({ user_id: user.id, kind: "test", title: "Notifications are on ✅", body: "You'll get follow-up reminders and new leads here." });
  return { ok: true };
}
