"use client";

import { useActionState } from "react";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { createFounder } from "./actions";

export function SetupForm() {
  const [state, action, pending] = useActionState(createFounder, null);
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <Field label="Your name" required><Input name="name" required /></Field>
      <Field label="Email" required><Input name="email" type="email" required /></Field>
      <Field label="Mobile"><Input name="phone" type="tel" placeholder="+971 50 123 4567" /></Field>
      <Field label="Password" hint="At least 8 characters" required><Input name="password" type="password" minLength={8} required /></Field>
      <ErrorText>{state?.error}</ErrorText>
      <Button className="w-full" size="lg" loading={pending}>Create founder account</Button>
    </form>
  );
}
