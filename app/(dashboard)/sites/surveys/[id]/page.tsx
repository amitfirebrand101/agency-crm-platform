import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SurveyBuilder } from "./survey-builder";

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  let survey = null;
  let responses: Awaited<ReturnType<typeof prisma.surveyResponse.findMany>> = [];
  try {
    survey = await prisma.survey.findFirst({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    });
    if (survey) {
      responses = await prisma.surveyResponse.findMany({
        where: { surveyId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }
  } catch {}

  if (!survey) {
    return (
      <div className="space-y-4">
        <Link href="/sites?tab=surveys" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
          <ArrowLeft size={14} /> Back to Surveys
        </Link>
        <p className="text-muted">Survey not found.</p>
      </div>
    );
  }

  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  const settings = (survey.settings && typeof survey.settings === "object" && !Array.isArray(survey.settings))
    ? survey.settings as Record<string, unknown>
    : {};

  return (
    <SurveyBuilder
      surveyId={survey.id}
      surveyName={survey.name}
      initialQuestions={questions as never}
      initialSettings={settings}
      responses={responses.map((r) => ({
        id: r.id,
        answers: r.answers as Record<string, unknown>,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
