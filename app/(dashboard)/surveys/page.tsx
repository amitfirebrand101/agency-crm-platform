import Link from "next/link";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
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

async function createSurvey(formData: FormData): Promise<void> {
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

  await prisma.survey.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name: parsed.data,
      questions: [],
      settings: {},
      status: "active",
    },
  });

  revalidatePath("/surveys");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SurveysPage() {
  const user = await requireUser();

  type SurveyWithCount = Awaited<ReturnType<typeof prisma.survey.findMany>>[number] & {
    _count: { responses: number };
  };

  let surveys: SurveyWithCount[] = [];
  let databaseUnavailable = false;

  try {
    surveys = (await prisma.survey.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { responses: true } } },
    })) as SurveyWithCount[];
  } catch (err) {
    databaseUnavailable = true;
    console.error("Surveys page query failed", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Surveys</h1>
        <p className="mt-1 text-sm text-muted">
          Collect structured feedback with multi-question surveys.
        </p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        {/* Surveys list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="text-primary" size={17} />
              <h2 className="font-semibold">Surveys</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {surveys.length}
              </span>
            </div>
          </CardHeader>

          {surveys.length === 0 && !databaseUnavailable ? (
            <CardBody>
              <div className="py-10 text-center">
                <ClipboardList className="mx-auto mb-3 text-muted" size={32} />
                <p className="font-semibold">No surveys yet</p>
                <p className="mt-1 text-sm text-muted">
                  Create your first survey using the panel on the right.
                </p>
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-border">
              {surveys.map((survey) => (
                <div
                  key={survey.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-background/50 transition"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardList size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{survey.name}</span>
                      <Badge variant={statusVariant(survey.status)}>{survey.status}</Badge>
                    </div>
                    <div className="mt-0.5 flex gap-3 text-xs text-muted">
                      <span>
                        {survey._count.responses} response{survey._count.responses !== 1 ? "s" : ""}
                      </span>
                      <span>Created {survey.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Link
                    href={`/sites/surveys/${survey.id}`}
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

        {/* New survey */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-primary" />
              <h2 className="font-semibold">New Survey</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createSurvey} className="space-y-4">
              <Field label="Survey Name" name="name" placeholder="Customer Feedback" required />
              <SubmitButton
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Creating…"
              >
                Create Survey
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
