export const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Dubai";

function ymd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Minutes the business timezone is ahead of UTC at a given instant. */
function tzOffsetMinutes(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - d.getTime()) / 60000);
}

/** A wall-clock time in the business timezone → real instant. */
export function zoned(dateYmd: string, hh = 0, mm = 0) {
  const guess = new Date(`${dateYmd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  return new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000);
}

export function startOfDay(d = new Date()) { return zoned(ymd(d)); }
export function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86400000); }
export function endOfDay(d = new Date()) { return startOfDay(addDays(startOfDay(d), 1.5)); }
export function dayKey(d: Date | string) { return ymd(new Date(d)); }

export function rangeFor(preset: string, from?: string, to?: string): { from: Date; to: Date; label: string } {
  const now = new Date();
  const today = startOfDay(now);
  if (preset === "week") {
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now),
    );
    const start = addDays(today, -((dow + 6) % 7));
    return { from: start, to: endOfDay(now), label: "This week" };
  }
  if (preset === "month") {
    const k = ymd(now).slice(0, 7);
    return { from: zoned(`${k}-01`), to: endOfDay(now), label: "This month" };
  }
  if (preset === "custom" && from && to) {
    return { from: zoned(from), to: endOfDay(zoned(to)), label: `${fmtDate(zoned(from))} – ${fmtDate(zoned(to))}` };
  }
  return { from: today, to: endOfDay(now), label: "Today" };
}

export function fmtTime(d: Date | string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(d));
}
export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).format(new Date(d));
}
export function fmtDateTime(d: Date | string) {
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}
export function fmtWeekday(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(d));
}

export function relative(d: Date | string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.round(diff / 60000);
  if (Math.abs(m) < 1) return "just now";
  if (m < 60 && m > 0) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24 && h > 0) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return "yesterday";
  if (days > 1 && days < 30) return `${days} days ago`;
  return fmtDate(d, { day: "numeric", month: "short", year: "numeric" });
}

export type DueTone = "overdue" | "today" | "future" | "none";

export function dueInfo(next: string | null, now = new Date()): { tone: DueTone; label: string } {
  if (!next) return { tone: "none", label: "No follow up" };
  const t = new Date(next);
  if (t.getTime() < now.getTime()) {
    const mins = Math.floor((now.getTime() - t.getTime()) / 60000);
    if (mins < 60) return { tone: "overdue", label: `${mins}m overdue` };
    const hrs = Math.floor(mins / 60);
    if (dayKey(t) === dayKey(now)) return { tone: "overdue", label: `${hrs}h overdue` };
    const days = Math.max(1, Math.round((startOfDay(now).getTime() - startOfDay(t).getTime()) / 86400000));
    return { tone: "overdue", label: `${days} day${days > 1 ? "s" : ""} overdue` };
  }
  if (dayKey(t) === dayKey(now)) return { tone: "today", label: `Due ${fmtTime(t)}` };
  if (dayKey(t) === dayKey(addDays(now, 1))) return { tone: "future", label: `Tomorrow ${fmtTime(t)}` };
  return { tone: "future", label: fmtDateTime(t) };
}

export function aed(n: number | null | undefined, compact = false) {
  const v = Number(n ?? 0);
  if (compact && Math.abs(v) >= 1000) {
    return "AED " + new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  }
  return "AED " + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
}
export function num(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(Number(n ?? 0));
}

/** Rotting colour on pipeline cards (Pipedrive style). */
export function rot(lastActivity: string, staleDays = 7): "fresh" | "amber" | "red" {
  const days = (Date.now() - new Date(lastActivity).getTime()) / 86400000;
  if (days >= staleDays) return "red";
  if (days >= Math.max(2, Math.floor(staleDays / 2))) return "amber";
  return "fresh";
}

export function waLink(phone: string, text?: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") || "?";
}

export function errMsg(e: unknown) {
  if (!e) return "Something went wrong";
  if (typeof e === "string") return e;
  const m = (e as { message?: string }).message;
  return m || "Something went wrong";
}
