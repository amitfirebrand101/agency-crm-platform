import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormBuilder } from "./form-builder";

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  let form = null;
  let submissions: Awaited<ReturnType<typeof prisma.formSubmission.findMany>> = [];
  try {
    form = await prisma.siteForm.findFirst({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    });
    if (form) {
      submissions = await prisma.formSubmission.findMany({
        where: { formId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }
  } catch {}

  if (!form) {
    return (
      <div className="space-y-4">
        <Link href="/sites?tab=forms" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
          <ArrowLeft size={14} /> Back to Forms
        </Link>
        <p className="text-muted">Form not found.</p>
      </div>
    );
  }

  const fields = Array.isArray(form.fields) ? form.fields : [];
  const settings = (form.settings && typeof form.settings === "object" && !Array.isArray(form.settings))
    ? form.settings as Record<string, unknown>
    : {};

  return (
    <FormBuilder
      formId={form.id}
      formName={form.name}
      initialFields={fields as never}
      initialSettings={settings}
      submissions={submissions.map((s) => ({
        id: s.id,
        data: s.data as Record<string, string>,
        createdAt: s.createdAt.toISOString(),
      }))}
    />
  );
}
