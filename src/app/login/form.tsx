"use client";

import { useActionState } from "react";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { login } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState(login, initialError ? { error: initialError } : null);
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <Field label="Email or phone">
        <Input name="identifier" autoComplete="username" placeholder="you@aventus.ae or 050 123 4567" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <ErrorText>{state?.error}</ErrorText>
      <Button className="w-full" size="lg" loading={pending}>Sign in</Button>
    </form>
  );
}
