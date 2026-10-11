"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";

async function assertFounder() {
  const { isFounder } = await getSession();
  if (!isFounder) throw new Error("Only the founder can manage the team");
}

export async function createAgent(input: { name: string; email: string; phone: string; password: string; role: "agent" | "founder" }) {
  await assertFounder();
  if (!input.name.trim() || !input.email.trim() || input.password.length < 8) return { error: "Name, email and a password of 8+ characters are required" };
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    app_metadata: { invited: true },
    user_metadata: { name: input.name.trim(), phone: input.phone.trim() },
  });
  if (error) return { error: error.message };
  if (input.role === "founder" && data.user) await admin.from("profiles").update({ role: "founder" }).eq("id", data.user.id);
  revalidatePath("/team");
  return { ok: true };
}

export async function resetPassword(userId: string, password: string) {
  await assertFounder();
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, { password });
  return error ? { error: error.message } : { ok: true };
}

export async function setAccess(userId: string, active: boolean) {
  await assertFounder();
  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  if (error) return { error: error.message };
  await admin.from("profiles").update({ active, on_leave: false }).eq("id", userId);
  revalidatePath("/team");
  return { ok: true };
}
