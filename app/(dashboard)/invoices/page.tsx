import { FileText, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { updateInvoiceStatus, deleteInvoice } from "./actions";
import { CreateInvoiceForm } from "./create-invoice-form";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type InvoiceWithContact = Prisma.InvoiceGetPayload<{
  include: {
    contact: { select: { firstName: true; lastName: true; email: true } };
    items: true;
  };
}>;

type ContactOption = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
};

const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function InvoicesPage() {
  const user = await requireUser();
  let invoices: InvoiceWithContact[] = [];
  let contacts: ContactOption[] = [];
  let databaseUnavailable = false;

  try {
    [invoices, contacts] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
        },
        include: {
          contact: { select: { firstName: true, lastName: true, email: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.contact.findMany({
        where: {
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
        },
        take: 100,
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { firstName: "asc" },
      }),
    ]);
  } catch (err) {
    databaseUnavailable = true;
    console.error("Invoices page database query failed", err);
  }

  const draftCount = invoices.filter((i) => i.status === "draft").length;
  const sentCount = invoices.filter((i) => i.status === "sent").length;
  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const totalRevenueCents = invoices.reduce((sum, i) => sum + i.paidCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-1 text-sm text-muted">Track payments and outstanding balances.</p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Draft</p>
          <p className="mt-1 text-2xl font-bold text-muted">{draftCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sent</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{sentCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paid</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{paidCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{formatCurrency(totalRevenueCents)}</p>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Invoice list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="text-primary" size={18} />
              <h2 className="font-semibold">Invoices</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {invoices.length}
              </span>
            </div>
          </CardHeader>

          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-background">
                <FileText className="text-muted" size={28} />
              </div>
              <p className="text-base font-semibold">No invoices yet</p>
              <p className="mt-1 text-sm text-muted">
                Create your first invoice using the form on the right.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map((invoice) => {
                const contactName = invoice.contact
                  ? [invoice.contact.firstName, invoice.contact.lastName].filter(Boolean).join(" ")
                  : null;
                const dueDateStr = formatDate(invoice.dueDate);
                const createdAtStr = formatDate(invoice.createdAt);

                return (
                  <div
                    key={invoice.id}
                    className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-background/50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-muted">
                          #{invoice.number}
                        </span>
                        <span className="font-medium truncate">{invoice.title}</span>
                        <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted">
                        <span>{contactName ?? "No contact"}</span>
                        <span className="font-semibold text-foreground text-sm">
                          {formatCurrency(invoice.totalCents)}
                        </span>
                        {dueDateStr && <span>Due {dueDateStr}</span>}
                        {createdAtStr && <span>Created {createdAtStr}</span>}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {/* Status update form */}
                      <form action={updateInvoiceStatus} className="flex items-center gap-1">
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <select
                          name="status"
                          defaultValue={invoice.status}
                          className="h-8 rounded border border-border bg-background px-1.5 text-xs outline-none ring-primary/20 focus:ring-4"
                        >
                          {INVOICE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                        <SubmitButton
                          className="h-8 rounded border border-border px-2.5 text-xs font-medium text-muted hover:bg-background hover:text-foreground transition"
                          pendingText="…"
                        >
                          Save
                        </SubmitButton>
                      </form>

                      {/* Delete form */}
                      <form action={deleteInvoice}>
                        <input type="hidden" name="id" value={invoice.id} />
                        <SubmitButton
                          className="flex items-center justify-center rounded-md border border-border p-2 text-muted hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition"
                          pendingText=""
                          title="Delete invoice"
                        >
                          <Trash2 size={14} />
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* New Invoice sidebar */}
        <div>
          <CreateInvoiceForm contacts={contacts} />
        </div>
      </section>
    </div>
  );
}
