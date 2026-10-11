"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, cn, EmptyState, PageHeader } from "@/components/ui";
import { relative } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";

const TONE: Record<string, string> = {
  sla: "bg-danger", unreachable: "bg-danger", commission_overdue: "bg-danger", untouched: "bg-danger", untouched_self: "bg-danger",
  stale: "bg-warning", recycle: "bg-warning", reassigned: "bg-warning", duplicate: "bg-warning",
  deal_won: "bg-success", commission_received: "bg-success", new_lead: "bg-info", future_buyer: "bg-info",
};

export function NotificationsView({ items }: { items: Notification[] }) {
  const router = useRouter();
  const unread = items.filter((n) => !n.read_at);
  async function markAll() {
    await supabaseBrowser().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    router.refresh();
  }
  async function read(n: Notification) {
    if (!n.read_at) await supabaseBrowser().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-4 md:px-8 md:py-8">
      <PageHeader title="Notifications" sub={`${unread.length} unread`} actions={unread.length > 0 && <Button variant="secondary" size="sm" onClick={markAll}>Mark all read</Button>} />
      {items.length === 0 ? <EmptyState icon={<Bell className="size-6" />} title="No notifications yet" /> : (
        <div className="divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-surface">
          {items.map((n) => {
            const inner = (
              <div className={cn("flex gap-3 px-4 py-3", !n.read_at && "bg-brand-50/40")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE[n.kind] ?? "bg-muted", n.read_at && "opacity-30")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[14px]", !n.read_at && "font-semibold")}>{n.title}</p>
                  {n.body && <p className="whitespace-pre-line text-[13px] text-muted">{n.body}</p>}
                  <p className="mt-0.5 text-[12px] text-muted">{relative(n.created_at)}</p>
                </div>
              </div>
            );
            return n.lead_id
              ? <Link key={n.id} href={`/leads/${n.lead_id}`} onClick={() => read(n)} className="block hover:bg-bg">{inner}</Link>
              : <button key={n.id} onClick={() => { read(n); router.refresh(); }} className="block w-full text-left hover:bg-bg">{inner}</button>;
          })}
        </div>
      )}
    </div>
  );
}
