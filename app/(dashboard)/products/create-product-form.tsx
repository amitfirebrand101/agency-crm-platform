"use client";

import { useActionState } from "react";
import { createProduct } from "./actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState = { error: null };

export function CreateProductForm() {
  const [state, formAction] = useActionState(createProduct, initialState);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Add Product</h2>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Field label="Name" name="name" placeholder="Website design package" required />

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Description
            </span>
            <textarea
              name="description"
              placeholder="Optional description…"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4 resize-none"
            />
          </label>

          <Field
            label="Price (USD)"
            name="price"
            type="number"
            placeholder="0.00"
            defaultValue="0"
          />

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Type
            </span>
            <select
              name="type"
              defaultValue="service"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
            >
              <option value="service">Service</option>
              <option value="physical">Physical</option>
              <option value="digital">Digital</option>
            </select>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="taxable"
              value="on"
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm font-medium">Taxable</span>
          </label>

          {state.error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <SubmitButton
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
            pendingText="Adding…"
          >
            Add Product
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
