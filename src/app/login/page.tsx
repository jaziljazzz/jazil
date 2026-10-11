import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await supabaseServer();
  const { data: founder } = await supabase.rpc("founder_exists");
  if (founder === false) redirect("/setup");
  const { error } = await searchParams;
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-brand text-lg font-bold text-white">A</div>
          <h1 className="mt-4 text-[20px] font-semibold">Aventus Realtors</h1>
          <p className="text-[13px] text-muted">Sign in to your CRM</p>
        </div>
        <LoginForm initialError={error === "inactive" ? "Your account is inactive. Ask the founder." : undefined} />
      </div>
    </div>
  );
}
