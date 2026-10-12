import "server-only";
import crypto from "node:crypto";

/** Requests from the database (pg_net) carry the shared secret. */
export function validHook(req: Request) {
  const got = req.headers.get("x-hook-secret") ?? "";
  const want = process.env.HOOK_SECRET ?? "";
  if (!want || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
