import Link from "next/link";
import { BookOpen, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCourse, deleteCourse } from "./actions";

export const dynamic = "force-dynamic";

type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  isFree: boolean;
  priceCents: number;
  createdAt: Date;
  sections: { id: string }[];
};

function priceLabel(course: CourseRow): string {
  if (course.isFree) return "Free";
  return `$${(course.priceCents / 100).toFixed(2)}`;
}

export default async function CoursesPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let courses: CourseRow[] = [];
  let publishedCount = 0;
  let draftCount = 0;

  try {
    courses = await prisma.course.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      include: {
        sections: { select: { id: true } },
      },
    });

    publishedCount = courses.filter((c) => c.status === "published").length;
    draftCount = courses.filter((c) => c.status === "draft").length;
  } catch (err) {
    databaseUnavailable = true;
    console.error("Courses page query failed", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Courses</h1>
        <p className="mt-1 text-sm text-muted">Build and sell online courses.</p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total</p>
          <p className="mt-1 text-2xl font-bold">{courses.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Published</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{publishedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Draft</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{draftCount}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Course grid */}
        <div className="space-y-4">
          {courses.length === 0 && !databaseUnavailable ? (
            <Card>
              <CardBody>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-background">
                    <BookOpen className="text-muted" size={28} />
                  </div>
                  <p className="font-semibold">No courses yet</p>
                  <p className="mt-1 text-sm text-muted">
                    Create your first course using the form on the right.
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-col rounded-lg border border-border bg-panel shadow-soft hover:border-primary/40 transition"
                >
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug line-clamp-2">{course.title}</h3>
                      <Badge variant={statusVariant(course.status)} className="shrink-0">
                        {course.status}
                      </Badge>
                    </div>

                    {course.description ? (
                      <p className="mt-2 text-sm text-muted line-clamp-3">{course.description}</p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-semibold text-foreground">{priceLabel(course)}</span>
                      <span>·</span>
                      <span>
                        {course.sections.length} section
                        {course.sections.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border px-4 py-3">
                    <form action={deleteCourse}>
                      <input type="hidden" name="id" value={course.id} />
                      <SubmitButton
                        className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-muted hover:border-red-300 hover:text-red-600 transition"
                        pendingText="…"
                      >
                        <Trash2 size={11} />
                        Delete
                      </SubmitButton>
                    </form>
                    <Link
                      href={`/courses/${course.id}`}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                    >
                      Edit
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New course form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="text-primary" size={18} />
              <h2 className="font-semibold">New Course</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createCourse} className="space-y-4">
              <Field label="Title" name="title" placeholder="Course title" required />

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Description
                </span>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Brief description of what students will learn…"
                  maxLength={1000}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4 resize-none"
                />
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="isFree"
                  defaultChecked
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm font-medium">Free course</span>
              </label>

              <Field
                label="Price (USD, ignored if free)"
                name="price"
                type="number"
                placeholder="0.00"
                defaultValue="0"
              />

              <SubmitButton
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Creating…"
              >
                Create Course
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
