"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function createFounder(_: unknown, form: FormData) {
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const phone = String(form.get("phone") || "").trim();
  const password = String(form.get("password") || "");
  if (!name || !email || password.length < 8) return { error: "Name, email and a password of at least 8 characters are required" };

  const admin = supabaseAdmin();
  const { data: exists } = await admin.rpc("founder_exists");
  if (exists) return { error: "The founder account already exists. Please sign in." };

  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { invited: true }, user_metadata: { name, phone } });
  if (error) return { error: error.message };

  const supabase = await supabaseServer();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/settings?welcome=1");
}
