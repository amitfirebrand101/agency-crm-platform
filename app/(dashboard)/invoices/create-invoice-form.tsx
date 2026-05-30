"use client";

import { useActionState } from "react";
import { createInvoice } from "./actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

type ContactOption = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
};

const initialState = { error: null };

export function CreateInvoiceForm({ contacts }: { contacts: ContactOption[] }) {
  const [state, formAction] = useActionState(createInvoice, initialState);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">New Invoice</h2>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Field label="Title" name="title" placeholder="Invoice" defaultValue="Invoice" required />

          <Field label="Number" name="number" placeholder="INV-001" required />

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Contact
            </span>
            <select
              name="contactId"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
            >
              <option value="">No contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                  {c.email ? ` — ${c.email}` : ""}
                </option>
              ))}
            </select>
          </label>

          <Field label="Due Date" name="dueDate" type="date" />

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Notes
            </span>
            <textarea
              name="notes"
              placeholder="Payment terms, notes for client…"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4 resize-none"
            />
          </label>

          {state.error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <SubmitButton
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
            pendingText="Creating…"
          >
            Create Invoice
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
