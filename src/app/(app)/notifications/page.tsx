import { getSession } from "@/lib/session";
import type { Notification } from "@/lib/types";
import { NotificationsView } from "./view";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { supabase, profile } = await getSession();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(150);
  return <NotificationsView items={(data ?? []) as Notification[]} />;
}
