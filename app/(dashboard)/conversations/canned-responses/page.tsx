import { ArrowLeft, MessageSquareQuote, Trash2 } from "lucide-react";
import Link from "next/link";
import { createCannedResponse, deleteCannedResponse } from "@/app/(dashboard)/conversations/canned-response-actions";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CannedResponse } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CannedResponsesPage() {
  const user = await requireUser();
  let responses: CannedResponse[] = [];
  let dbError = false;

  try {
    if (user.subAccountId) {
      responses = await prisma.cannedResponse.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId },
        orderBy: { createdAt: "asc" },
      });
    }
  } catch {
    dbError = true;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {dbError && <DbWarning />}

      <div className="flex items-center gap-3">
        <Link
          href="/conversations"
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition"
        >
          <ArrowLeft size={14} />
          Back to conversations
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <MessageSquareQuote size={22} className="text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Canned Responses</h1>
          <p className="text-sm text-muted">Quick reply templates for your team.</p>
        </div>
      </div>

      {/* Add new */}
      <div className="rounded-lg border border-border bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">New response</h2>
        <form action={createCannedResponse} className="space-y-3">
          <Field
            label="Name"
            name="name"
            placeholder="e.g. Appointment confirmation"
            required
          />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Body <span className="text-red-500">*</span>
            </span>
            <textarea
              name="body"
              rows={4}
              required
              placeholder="Type the message template…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
            />
          </label>
          <SubmitButton
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
            pendingText="Adding…"
          >
            Add response
          </SubmitButton>
        </form>
      </div>

      {/* List */}
      <div className="space-y-2">
        {responses.length === 0 ? (
          <p className="rounded-lg border border-border bg-panel px-5 py-10 text-center text-sm text-muted">
            No canned responses yet. Add one above.
          </p>
        ) : (
          responses.map((resp) => (
            <div
              key={resp.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-panel px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{resp.name}</p>
                <p className="mt-0.5 text-xs text-muted line-clamp-2">{resp.body}</p>
              </div>
              <form action={deleteCannedResponse}>
                <input type="hidden" name="id" value={resp.id} />
                <SubmitButton
                  className="flex size-8 items-center justify-center rounded-md border border-border text-muted hover:border-red-300 hover:text-red-600 transition"
                  pendingText="…"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </SubmitButton>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
