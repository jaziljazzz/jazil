import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { SetupForm } from "./form";

export const metadata = { title: "Set up" };

export default async function SetupPage() {
  const supabase = await supabaseServer();
  const { data: founder, error } = await supabase.rpc("founder_exists");
  if (!error && founder) redirect("/login");
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-brand text-lg font-bold text-white">A</div>
          <h1 className="mt-4 text-[20px] font-semibold">Welcome to Aventus CRM</h1>
          <p className="text-[13px] text-muted">Create the founder account. You can add agents after this.</p>
        </div>
        {error && (
          <p className="mb-4 rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger">
            Database not ready: run the SQL migrations in Supabase first. ({error.message})
          </p>
        )}
        <SetupForm />
      </div>
    </div>
  );
}
