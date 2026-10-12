import { waLink } from "./format";

export type WaApp = "business" | "personal";
const KEY = "aventus.waApp";

export function getWaApp(): WaApp {
  try { return (localStorage.getItem(KEY) as WaApp) || "business"; } catch { return "business"; }
}
export function setWaApp(v: WaApp) {
  try { localStorage.setItem(KEY, v); } catch {}
}

/**
 * Opens a chat with the number. On Android an intent targets the chosen app directly
 * (WhatsApp Business = com.whatsapp.w4b, WhatsApp = com.whatsapp) and falls back to wa.me if it isn't installed.
 * iPhone can't target a specific app from the browser, so wa.me opens whichever WhatsApp is installed.
 */
/** Hands a URL (tel:, intent:, whatsapp:) to the phone. Tests can intercept via window.__aventusNav. */
export function goExternal(url: string) {
  const hook = (window as unknown as { __aventusNav?: (u: string) => void }).__aventusNav;
  if (hook) return hook(url);
  window.location.href = url;
}

export function openWhatsApp(phone: string, text?: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  const fallback = waLink(phone, text);
  if (/Android/i.test(navigator.userAgent)) {
    const pkg = getWaApp() === "business" ? "com.whatsapp.w4b" : "com.whatsapp";
    const q = `phone=${digits}${text ? `&text=${encodeURIComponent(text)}` : ""}`;
    goExternal(`intent://send/?${q}#Intent;scheme=whatsapp;package=${pkg};S.browser_fallback_url=${encodeURIComponent(fallback)};end`);
    return;
  }
  window.open(fallback, "_blank");
}
