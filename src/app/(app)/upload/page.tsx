import { requireFounder, getTeam } from "@/lib/session";
import { UploadWizard } from "./wizard";

export const metadata = { title: "Upload leads" };

export default async function UploadPage() {
  const { supabase } = await requireFounder();
  const team = await getTeam();
  const { data: batches } = await supabase.from("lead_batches").select("*").order("uploaded_at", { ascending: false }).limit(20);
  return <UploadWizard team={team} batches={batches ?? []} />;
}
