"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Schemas ────────────────────────────────────────────────────────────────────

const createCourseSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  isFree: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true" || v === "1"),
  price: z.coerce.number().min(0, "Price must be 0 or greater").default(0),
});

const updateCourseStatusSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  status: z.enum(["draft", "published", "archived"], { message: "Invalid status" }),
});

const createCourseSectionSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  title: z.string().trim().min(1, "Section title is required").max(200),
});

const createCourseLessonSchema = z.object({
  sectionId: z.string().uuid("Invalid section ID"),
  courseId: z.string().uuid("Invalid course ID"),
  title: z.string().trim().min(1, "Lesson title is required").max(200),
  type: z.enum(["video", "text", "audio", "quiz"], { message: "Invalid lesson type" }),
});

const deleteCourseSchema = z.object({
  id: z.string().uuid("Invalid course ID"),
});

// ── Actions ────────────────────────────────────────────────────────────────────

export async function createCourse(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof createCourseSchema>;
  try {
    input = createCourseSchema.parse(Object.fromEntries(formData));
  } catch (err) {
    console.error("createCourse validation failed", err);
    return;
  }

  try {
    await prisma.course.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        title: input.title,
        description: input.description ?? null,
        isFree: input.isFree,
        priceCents: input.isFree ? 0 : Math.round(input.price * 100),
        status: "draft",
      },
    });
  } catch (err) {
    console.error("createCourse failed", err);
    return;
  }

  revalidatePath("/courses");
}

export async function updateCourseStatus(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof updateCourseStatusSchema>;
  try {
    input = updateCourseStatusSchema.parse({
      courseId: formData.get("courseId"),
      status: formData.get("status"),
    });
  } catch (err) {
    console.error("updateCourseStatus validation failed", err);
    return;
  }

  try {
    const course = await prisma.course.findFirstOrThrow({
      where: {
        id: input.courseId,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
      select: { id: true },
    });

    await prisma.course.update({
      where: { id: course.id },
      data: { status: input.status },
    });
  } catch (err) {
    console.error("updateCourseStatus failed", err);
    return;
  }

  revalidatePath("/courses");
  revalidatePath(`/courses/${input.courseId}`);
}

export async function createCourseSection(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof createCourseSectionSchema>;
  try {
    input = createCourseSectionSchema.parse({
      courseId: formData.get("courseId"),
      title: formData.get("title"),
    });
  } catch (err) {
    console.error("createCourseSection validation failed", err);
    return;
  }

  try {
    // Verify course belongs to this agency
    await prisma.course.findFirstOrThrow({
      where: {
        id: input.courseId,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
      select: { id: true },
    });

    // Find the current max position to append after it
    const maxPositionResult = await prisma.courseSection.aggregate({
      where: { courseId: input.courseId },
      _max: { position: true },
    });
    const nextPosition = (maxPositionResult._max.position ?? -1) + 1;

    await prisma.courseSection.create({
      data: {
        courseId: input.courseId,
        title: input.title,
        position: nextPosition,
      },
    });
  } catch (err) {
    console.error("createCourseSection failed", err);
    return;
  }

  revalidatePath(`/courses/${input.courseId}`);
}

export async function createCourseLesson(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof createCourseLessonSchema>;
  try {
    input = createCourseLessonSchema.parse({
      sectionId: formData.get("sectionId"),
      courseId: formData.get("courseId"),
      title: formData.get("title"),
      type: formData.get("type"),
    });
  } catch (err) {
    console.error("createCourseLesson validation failed", err);
    return;
  }

  try {
    // Verify course belongs to this agency
    await prisma.course.findFirstOrThrow({
      where: {
        id: input.courseId,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
      select: { id: true },
    });

    // Find max position among lessons in this section
    const maxPositionResult = await prisma.courseLesson.aggregate({
      where: { sectionId: input.sectionId },
      _max: { position: true },
    });
    const nextPosition = (maxPositionResult._max.position ?? -1) + 1;

    await prisma.courseLesson.create({
      data: {
        sectionId: input.sectionId,
        courseId: input.courseId,
        title: input.title,
        type: input.type,
        content: {},
        position: nextPosition,
      },
    });
  } catch (err) {
    console.error("createCourseLesson failed", err);
    return;
  }

  revalidatePath(`/courses/${input.courseId}`);
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof deleteCourseSchema>;
  try {
    input = deleteCourseSchema.parse({ id: formData.get("id") });
  } catch (err) {
    console.error("deleteCourse validation failed", err);
    return;
  }

  try {
    const course = await prisma.course.findFirstOrThrow({
      where: {
        id: input.id,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
      select: { id: true },
    });

    await prisma.course.delete({ where: { id: course.id } });
  } catch (err) {
    console.error("deleteCourse failed", err);
    return;
  }

  revalidatePath("/courses");
}
