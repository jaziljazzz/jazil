import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/server/origin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getIntegrations } from "@/lib/server/integrations";
import { connectPage, pagesFromCode } from "@/lib/server/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Facebook sends the founder back here after login. One Page → connect; several → let them pick. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const back = (q: string) => {
    const res = NextResponse.redirect(`${origin}/connectors?${q}`);
    res.cookies.delete("meta_oauth_state");
    return res;
  };
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back(`open=meta&error=${encodeURIComponent(sp.get("error_description") || "Facebook login was cancelled")}`);
  const state = req.cookies.get("meta_oauth_state")?.value;
  if (!state || state !== sp.get("state")) return back(`open=meta&error=${encodeURIComponent("Login expired, please try again")}`);

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).single() : { data: null };
  if (profile?.role !== "founder") return back(`error=${encodeURIComponent("Only the founder can connect Meta")}`);

  try {
    const cfg = await getIntegrations();
    const { userName, pages } = await pagesFromCode(cfg, sp.get("code") ?? "", `${origin}/api/connect/meta/callback`);
    if (pages.length === 0) return back(`open=meta&error=${encodeURIComponent("No Facebook Pages found. Make sure you manage the Aventus Page and allowed access to it.")}`);
    if (pages.length === 1) {
      await connectPage(cfg, pages[0]!, userName, origin);
      return back("open=meta&connected=1");
    }
    await supabaseAdmin().from("integrations").update({ meta_pages_pending: pages, meta_user_name: userName }).eq("id", 1);
    return back("open=meta&pick=1");
  } catch (e) {
    return back(`open=meta&error=${encodeURIComponent((e as Error).message)}`);
  }
}
