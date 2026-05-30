import Link from "next/link";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Inline server action ──────────────────────────────────────────────────────

async function createSiteForm(formData: FormData): Promise<void> {
  "use server";
  const user = await requireUser();
  if (!user.subAccountId) throw new Error("No sub-account context.");

  const parsed = z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .safeParse(String(formData.get("name") ?? ""));

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Validation failed.");
  }

  await prisma.siteForm.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name: parsed.data,
      fields: [],
      settings: {},
      status: "active",
    },
  });

  revalidatePath("/forms");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FormsPage() {
  const user = await requireUser();

  type FormWithCount = Awaited<ReturnType<typeof prisma.siteForm.findMany>>[number] & {
    _count: { submissions: number };
  };

  let forms: FormWithCount[] = [];
  let databaseUnavailable = false;

  try {
    forms = (await prisma.siteForm.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { submissions: true } } },
    })) as FormWithCount[];
  } catch (err) {
    databaseUnavailable = true;
    console.error("Forms page query failed", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Forms</h1>
        <p className="mt-1 text-sm text-muted">Capture leads with embeddable web forms.</p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        {/* Forms list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="text-primary" size={17} />
              <h2 className="font-semibold">Forms</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {forms.length}
              </span>
            </div>
          </CardHeader>

          {forms.length === 0 && !databaseUnavailable ? (
            <CardBody>
              <div className="py-10 text-center">
                <FileText className="mx-auto mb-3 text-muted" size={32} />
                <p className="font-semibold">No forms yet</p>
                <p className="mt-1 text-sm text-muted">
                  Create your first form using the panel on the right.
                </p>
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-border">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-background/50 transition"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{form.name}</span>
                      <Badge variant={statusVariant(form.status)}>{form.status}</Badge>
                    </div>
                    <div className="mt-0.5 flex gap-3 text-xs text-muted">
                      <span>{form._count.submissions} submission{form._count.submissions !== 1 ? "s" : ""}</span>
                      <span>Created {form.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Link
                    href={`/sites/forms/${form.id}`}
                    className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                  >
                    Open
                    <ChevronRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* New form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-primary" />
              <h2 className="font-semibold">New Form</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createSiteForm} className="space-y-4">
              <Field label="Form Name" name="name" placeholder="Contact Us" required />
              <SubmitButton
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Creating…"
              >
                Create Form
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
