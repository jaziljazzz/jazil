"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/push-actions";
import { Button, cn } from "./ui";

type State = "unsupported" | "needs-install" | "denied" | "off" | "on" | "loading";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePush() {
  const [state, setState] = useState<State>("loading");
  const refresh = useCallback(async () => {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(ios && !standalone ? "needs-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub ? "on" : "off");
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription(json, navigator.userAgent);
      setState("on");
      await sendTestPush();
    } catch {
      refresh();
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
    setState("off");
  }, []);

  return { state, enable, disable };
}

/** Card used in the side menu and Settings. */
export function PushCard({ className }: { className?: string }) {
  const { state, enable, disable } = usePush();
  const text: Record<State, string> = {
    loading: "Checking…",
    on: "On for this phone: follow-up reminders, new leads and summaries.",
    off: "Get follow-up reminders and new leads on this phone.",
    denied: "Blocked. Allow notifications for this site in your browser settings.",
    unsupported: "This browser can't show notifications. Use Chrome on Android.",
    "needs-install": "On iPhone, first tap Share → Add to Home Screen, then open the app from your home screen.",
  };
  return (
    <div className={cn("rounded-2xl bg-surface p-4", className)}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", state === "on" ? "bg-success-50 text-success" : "bg-bg text-ink/60")}>
          {state === "on" ? <BellRing className="size-5" /> : state === "denied" ? <BellOff className="size-5" /> : <Bell className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium">Phone notifications</p>
          <p className="text-[12px] text-muted">{text[state]}</p>
        </div>
      </div>
      {state === "off" && <Button className="mt-3 w-full" onClick={enable}>Turn on notifications</Button>}
      {state === "on" && (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => sendTestPush()}>Send test</Button>
          <Button variant="ghost" size="sm" onClick={disable}>Turn off</Button>
        </div>
      )}
    </div>
  );
}

/** Slim prompt on My Day until notifications are on (dismissible). */
export function PushBanner() {
  const { state, enable } = usePush();
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem("aventus.pushBannerHidden") === "1"); } catch { setHidden(false); } }, []);
  if (hidden || (state !== "off" && state !== "needs-install")) return null;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand-50 p-3">
      <BellRing className="size-5 shrink-0 text-brand" />
      <p className="flex-1 text-[13px] text-ink/80">
        {state === "needs-install" ? "Add Aventus to your Home Screen to get follow-up reminders." : "Get a reminder on your phone when a follow-up is due."}
      </p>
      {state === "off" && <Button size="sm" onClick={enable}>Turn on</Button>}
      <button onClick={() => { setHidden(true); try { localStorage.setItem("aventus.pushBannerHidden", "1"); } catch {} }} className="text-[12px] text-muted">Later</button>
    </div>
  );
}
