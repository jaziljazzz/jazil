import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/server/origin";
import { supabaseServer } from "@/lib/supabase/server";
import { getIntegrations } from "@/lib/server/integrations";
import { META_DIALOG, META_SCOPES, metaReady } from "@/lib/server/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Founder taps "Connect with Facebook" → Facebook Login dialog. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role,active").eq("id", user.id).single() : { data: null };
  if (!profile || profile.role !== "founder" || !profile.active) return NextResponse.redirect(`${origin}/connectors?error=${encodeURIComponent("Only the founder can connect Meta")}`);

  const cfg = await getIntegrations();
  if (!metaReady(cfg)) return NextResponse.redirect(`${origin}/connectors?open=meta&error=${encodeURIComponent("Finish the one-time Meta app setup first")}`);

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: cfg.meta_app_id!,
    redirect_uri: `${origin}/api/connect/meta/callback`,
    state,
    response_type: "code",
  });
  // Facebook Login for Business apps use a configuration ID; classic apps use scopes.
  if (cfg.meta_login_config_id) params.set("config_id", cfg.meta_login_config_id);
  else params.set("scope", META_SCOPES.join(","));
  const res = NextResponse.redirect(`${META_DIALOG}?${params}`);
  res.cookies.set("meta_oauth_state", state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
