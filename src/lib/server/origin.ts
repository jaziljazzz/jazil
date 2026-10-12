import "server-only";
import type { NextRequest } from "next/server";

/** The address the browser used (behind Vercel's proxy too), so OAuth redirects and cookies match. */
export function publicOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
