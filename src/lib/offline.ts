"use client";

import { supabaseBrowser } from "./supabase/client";

/** Changes made with no signal are kept on the phone and sent when the connection returns. */
const KEY = "aventus.offlineQueue";
type Item = { fn: string; args: Record<string, unknown>; at: number; label: string };

function read(): Item[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(items: Item[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  window.dispatchEvent(new Event("aventus:queue"));
}
export function queuedCount() { return read().length; }

function isNetworkError(e: unknown) {
  const m = String((e as { message?: string })?.message ?? e);
  return /Failed to fetch|NetworkError|Load failed|network/i.test(m);
}

/** Calls an RPC; if the phone is offline (or the request can't reach the server) it queues it instead. */
export async function rpcOrQueue(fn: string, args: Record<string, unknown>, label: string): Promise<{ queued: boolean; error: { message: string } | null }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    write([...read(), { fn, args, at: Date.now(), label }]);
    return { queued: true, error: null };
  }
  try {
    const { error } = await supabaseBrowser().rpc(fn, args);
    if (error && isNetworkError(error)) {
      write([...read(), { fn, args, at: Date.now(), label }]);
      return { queued: true, error: null };
    }
    return { queued: false, error };
  } catch (e) {
    if (isNetworkError(e)) {
      write([...read(), { fn, args, at: Date.now(), label }]);
      return { queued: true, error: null };
    }
    return { queued: false, error: { message: String((e as Error).message ?? e) } };
  }
}

/** Sends queued changes in order. Items the server rejects (e.g. follow-up now in the past) are reported and dropped. */
export async function flushQueue(): Promise<{ sent: number; failed: string[] }> {
  const items = read();
  if (!items.length || !navigator.onLine) return { sent: 0, failed: [] };
  const left: Item[] = [];
  const failed: string[] = [];
  let sent = 0;
  for (const it of items) {
    try {
      const { error } = await supabaseBrowser().rpc(it.fn, it.args);
      if (!error) sent++;
      else if (isNetworkError(error)) left.push(it);
      else failed.push(`${it.label}: ${error.message}`);
    } catch {
      left.push(it);
    }
  }
  write(left);
  return { sent, failed };
}
