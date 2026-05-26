"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createContact } from "./actions";

const initialState = { error: null };

export function CreateContactForm() {
  const [state, formAction] = useActionState(createContact, initialState);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plus className="text-primary" size={18} />
          <h2 className="font-semibold">New contact</h2>
        </div>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" name="firstName" required />
            <Field label="Last name" name="lastName" />
          </div>
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
          <Field label="Company" name="companyName" />
          <Field label="Source" name="source" placeholder="Website, referral…" />

          {state.error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <SubmitButton
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            pendingText="Creating…"
          >
            Create contact
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
