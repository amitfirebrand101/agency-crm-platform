import { Braces, Copy, Trash2 } from "lucide-react";
import {
  createCustomValue,
  deleteCustomValue,
} from "@/app/(dashboard)/custom-values/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomValuesPage() {
  const user = await requireUser();
  let customValues: Awaited<ReturnType<typeof prisma.customValue.findMany>> = [];
  let databaseUnavailable = false;

  try {
    customValues = await prisma.customValue.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? null,
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    databaseUnavailable = true;
    console.error("Custom values page query failed", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Custom Values</h1>
        <p className="mt-1 text-sm text-muted">
          Define merge fields like <code className="rounded bg-background px-1 text-xs">{"{{business.name}}"}</code> for use in messages and templates.
        </p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Values list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Braces className="text-primary" size={17} />
              <h2 className="font-semibold">Custom Values</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {customValues.length}
              </span>
            </div>
          </CardHeader>

          {customValues.length === 0 && !databaseUnavailable ? (
            <CardBody>
              <div className="py-10 text-center">
                <Braces className="mx-auto mb-3 text-muted" size={32} />
                <p className="font-semibold">No custom values yet</p>
                <p className="mt-1 text-sm text-muted">
                  Add your first merge field using the form on the right.
                </p>
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-border">
              {customValues.map((cv) => (
                <div
                  key={cv.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-background/50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{cv.name}</span>
                      <code className="rounded bg-background px-2 py-0.5 font-mono text-xs text-primary">
                        {`{{${cv.key}}}`}
                      </code>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted" title={cv.value}>
                      {cv.value.length > 80 ? cv.value.slice(0, 80) + "…" : cv.value}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Copy key button — client-side copy via form trick */}
                    <button
                      type="button"
                      onClick={undefined}
                      data-copy={`{{${cv.key}}}`}
                      className="copy-key flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-background hover:text-foreground transition"
                      title={`Copy {{${cv.key}}}`}
                    >
                      <Copy size={11} />
                      Copy
                    </button>
                    <form action={deleteCustomValue}>
                      <input type="hidden" name="id" value={cv.id} />
                      <SubmitButton
                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                        pendingText="…"
                      >
                        <Trash2 size={11} />
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Add value form */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Add Value</h2>
          </CardHeader>
          <CardBody>
            <form action={createCustomValue} className="space-y-4">
              <Field
                label="Display Name"
                name="name"
                placeholder="Business Name"
                required
              />
              <Field
                label="Key — use lowercase_snake_case"
                name="key"
                placeholder="business_name"
                required
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Value
                </span>
                <textarea
                  name="value"
                  required
                  rows={3}
                  placeholder="Acme Corp"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4 resize-y"
                />
              </label>
              <SubmitButton
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Saving…"
              >
                Save Value
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>

      {/* Client-side copy handler */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('click', function(e) {
              const btn = e.target.closest('.copy-key');
              if (!btn) return;
              const text = btn.getAttribute('data-copy');
              if (!text) return;
              navigator.clipboard.writeText(text).then(function() {
                const orig = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(function() { btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy'; }, 1500);
              });
            });
          `,
        }}
      />
    </div>
  );
}
