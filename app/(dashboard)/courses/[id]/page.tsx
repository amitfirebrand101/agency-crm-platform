import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, ChevronLeft, FileText, Mic, PlayCircle, HelpCircle, Plus } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  updateCourseStatus,
  createCourseSection,
  createCourseLesson,
} from "../actions";

export const dynamic = "force-dynamic";

type Lesson = {
  id: string;
  title: string;
  type: string;
  duration: number | null;
  position: number;
  isFree: boolean;
};

type Section = {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};

type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  isFree: boolean;
  priceCents: number;
  sections: Section[];
};

function lessonTypeIcon(type: string) {
  switch (type) {
    case "video":
      return <PlayCircle size={13} className="shrink-0 text-blue-500" />;
    case "audio":
      return <Mic size={13} className="shrink-0 text-purple-500" />;
    case "quiz":
      return <HelpCircle size={13} className="shrink-0 text-amber-500" />;
    default:
      return <FileText size={13} className="shrink-0 text-muted" />;
  }
}

function priceLabel(course: CourseDetail): string {
  if (course.isFree) return "Free";
  return `$${(course.priceCents / 100).toFixed(2)}`;
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  let course: CourseDetail | null = null;
  try {
    const raw = await prisma.course.findFirst({
      where: {
        id,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? undefined,
      },
      include: {
        sections: {
          orderBy: { position: "asc" },
          include: {
            lessons: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                position: true,
                isFree: true,
              },
            },
          },
        },
      },
    });

    if (!raw) return notFound();
    course = raw;
  } catch (err) {
    console.error("Course detail page failed", err);
    return notFound();
  }

  const totalLessons = course.sections.reduce((acc, s) => acc + s.lessons.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/courses"
          className="mt-1 flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-background hover:text-foreground transition"
        >
          <ChevronLeft size={13} />
          Courses
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold truncate">{course.title}</h1>
            <Badge variant={statusVariant(course.status)}>{course.status}</Badge>
          </div>
          {course.description ? (
            <p className="mt-1 text-sm text-muted">{course.description}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="font-medium text-foreground">{priceLabel(course)}</span>
            <span>·</span>
            <span>
              {course.sections.length} section{course.sections.length !== 1 ? "s" : ""}
            </span>
            <span>·</span>
            <span>
              {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Left: sections + lessons */}
        <div className="space-y-4">
          {/* Update status */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Course Status</h2>
            </CardHeader>
            <CardBody>
              <form action={updateCourseStatus} className="flex items-end gap-3">
                <input type="hidden" name="courseId" value={course.id} />
                <div className="flex-1">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Status
                    </span>
                    <select
                      name="status"
                      defaultValue={course.status}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                </div>
                <SubmitButton
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                  pendingText="Saving…"
                >
                  Save
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          {/* Sections list */}
          {course.sections.length === 0 ? (
            <Card>
              <CardBody>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="mb-3 text-muted" size={28} />
                  <p className="font-semibold">No sections yet</p>
                  <p className="mt-1 text-sm text-muted">
                    Add your first section using the form on the right.
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {course.sections.map((section, sectionIndex) => (
                <Card key={section.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {sectionIndex + 1}
                      </span>
                      <h3 className="font-semibold">{section.title}</h3>
                      <span className="ml-auto text-xs text-muted">
                        {section.lessons.length} lesson{section.lessons.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {/* Lessons */}
                    {section.lessons.length > 0 ? (
                      <ul className="mb-4 divide-y divide-border rounded-md border border-border">
                        {section.lessons.map((lesson, lessonIndex) => (
                          <li
                            key={lesson.id}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm"
                          >
                            <span className="w-5 shrink-0 text-right text-xs text-muted">
                              {lessonIndex + 1}
                            </span>
                            {lessonTypeIcon(lesson.type)}
                            <span className="flex-1 font-medium">{lesson.title}</span>
                            <span className="shrink-0 text-xs text-muted capitalize">
                              {lesson.type}
                            </span>
                            {lesson.duration ? (
                              <span className="shrink-0 text-xs text-muted">
                                {lesson.duration} min
                              </span>
                            ) : null}
                            {lesson.isFree ? (
                              <Badge variant="success" className="text-[10px]">
                                Free preview
                              </Badge>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mb-4 text-sm text-muted">No lessons in this section yet.</p>
                    )}

                    {/* Add lesson form */}
                    <form action={createCourseLesson} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="sectionId" value={section.id} />
                      <input type="hidden" name="courseId" value={course.id} />
                      <div className="flex-1 min-w-40">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                            Lesson title
                          </span>
                          <input
                            name="title"
                            required
                            placeholder="Lesson title…"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                          />
                        </label>
                      </div>
                      <div className="w-36">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                            Type
                          </span>
                          <select
                            name="type"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                          >
                            <option value="video">Video</option>
                            <option value="text">Text</option>
                            <option value="audio">Audio</option>
                            <option value="quiz">Quiz</option>
                          </select>
                        </label>
                      </div>
                      <SubmitButton
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-background transition"
                        pendingText="Adding…"
                      >
                        <Plus size={13} />
                        Add Lesson
                      </SubmitButton>
                    </form>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right: add section form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">Add Section</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createCourseSection} className="space-y-4">
                <input type="hidden" name="courseId" value={course.id} />
                <Field label="Section Title" name="title" placeholder="e.g. Introduction" required />
                <SubmitButton
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
                  pendingText="Adding…"
                >
                  Add Section
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          {/* Course overview card */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Overview</h2>
            </CardHeader>
            <CardBody>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Status</dt>
                  <dd>
                    <Badge variant={statusVariant(course.status)}>{course.status}</Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Pricing</dt>
                  <dd className="font-medium">{priceLabel(course)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Sections</dt>
                  <dd className="font-medium">{course.sections.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Lessons</dt>
                  <dd className="font-medium">{totalLessons}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
