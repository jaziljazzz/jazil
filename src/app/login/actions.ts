"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

function normalizePhone(p: string) {
  let d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (!d.startsWith("+")) {
    d = d.replace(/\D/g, "");
    if (d.startsWith("05") && d.length === 10) d = "+971" + d.slice(1);
    else if (d.startsWith("5") && d.length === 9) d = "+971" + d;
    else d = "+" + d;
  }
  return d;
}

export async function login(_: unknown, form: FormData) {
  const id = String(form.get("identifier") || "").trim();
  const password = String(form.get("password") || "");
  if (!id || !password) return { error: "Enter your email or phone and password" };

  let email = id;
  if (!id.includes("@")) {
    // Phone login: look up the email for this phone with the service role (never exposed to the browser).
    const phone = normalizePhone(id);
    const admin = supabaseAdmin();
    const { data } = await admin.from("profiles").select("email, phone").not("phone", "is", null);
    const match = (data ?? []).find((p) => p.phone && normalizePhone(p.phone) === phone);
    if (!match?.email) return { error: "Wrong phone/email or password" };
    email = match.email;
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong phone/email or password" };
  redirect("/today");
}
