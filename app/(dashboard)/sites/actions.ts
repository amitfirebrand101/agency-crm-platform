"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";

async function requireWritable() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage sites.");
  }
  return user as typeof user & { subAccountId: string };
}

// ─── Funnels ──────────────────────────────────────────────────────────────────

export async function createFunnel(formData: FormData) {
  const user = await requireWritable();
  const input = z.object({
    name: z.string().trim().min(2).max(120),
    type: z.enum(["funnel", "website"]).default("funnel"),
    domain: z.string().trim().max(200).optional(),
    description: z.string().trim().max(500).optional(),
  }).parse(Object.fromEntries(formData));

  const funnel = await prisma.funnel.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name: input.name,
      type: input.type,
      domain: input.domain || null,
      description: input.description || null,
    },
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Funnel", entityId: funnel.id });
  redirect(`/sites/funnels/${funnel.id}`);
}

export async function updateFunnel(formData: FormData) {
  const user = await requireWritable();
  const input = z.object({
    funnelId: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    domain: z.string().trim().max(200).optional(),
    description: z.string().trim().max(500).optional(),
    status: z.enum(["draft", "published"]).optional(),
  }).parse(Object.fromEntries(formData));

  const funnel = await prisma.funnel.findFirstOrThrow({
    where: { id: input.funnelId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });

  await prisma.funnel.update({
    where: { id: funnel.id },
    data: {
      name: input.name,
      domain: input.domain || null,
      description: input.description || null,
      ...(input.status ? { status: input.status } : {}),
    },
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Funnel", entityId: funnel.id });
  revalidatePath("/sites");
  revalidatePath(`/sites/funnels/${funnel.id}`);
}

export async function deleteFunnel(formData: FormData) {
  const user = await requireWritable();
  const funnelId = z.string().uuid().parse(String(formData.get("funnelId") ?? ""));
  await prisma.funnel.delete({ where: { id: funnelId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "DELETE", entityType: "Funnel", entityId: funnelId });
  revalidatePath("/sites");
  redirect("/sites");
}

export async function publishFunnel(formData: FormData) {
  const user = await requireWritable();
  const funnelId = z.string().uuid().parse(String(formData.get("funnelId") ?? ""));
  const funnel = await prisma.funnel.findFirstOrThrow({
    where: { id: funnelId, agencyId: user.agencyId },
    include: { pages: true },
  });
  if (!funnel.pages.length) throw new Error("Add at least one step before publishing.");
  await prisma.funnel.update({ where: { id: funnelId }, data: { status: "published" } });
  revalidatePath(`/sites/funnels/${funnelId}`);
  revalidatePath("/sites");
}

export async function unpublishFunnel(formData: FormData) {
  const user = await requireWritable();
  const funnelId = z.string().uuid().parse(String(formData.get("funnelId") ?? ""));
  await prisma.funnel.findFirstOrThrow({ where: { id: funnelId, agencyId: user.agencyId } });
  await prisma.funnel.update({ where: { id: funnelId }, data: { status: "draft" } });
  revalidatePath(`/sites/funnels/${funnelId}`);
  revalidatePath("/sites");
}

// ─── Funnel Pages (Steps) ─────────────────────────────────────────────────────

export async function addFunnelStep(formData: FormData) {
  const user = await requireWritable();
  const input = z.object({
    funnelId: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    type: z.enum(["opt-in", "sales", "upsell", "downsell", "confirmation", "checkout", "custom"]).default("sales"),
    pathSlug: z.string().trim().min(1).max(80),
  }).parse(Object.fromEntries(formData));

  const funnel = await prisma.funnel.findFirstOrThrow({
    where: { id: input.funnelId, agencyId: user.agencyId, subAccountId: user.subAccountId },
    include: { _count: { select: { pages: true } } },
  });

  const page = await prisma.funnelPage.create({
    data: {
      funnelId: funnel.id,
      name: input.name,
      pathSlug: input.pathSlug,
      type: input.type,
      order: funnel._count.pages,
    },
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "FunnelPage", entityId: page.id });
  revalidatePath(`/sites/funnels/${input.funnelId}`);
}

export async function updateFunnelStep(formData: FormData) {
  const user = await requireWritable();
  const input = z.object({
    pageId: z.string().uuid(),
    funnelId: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    type: z.enum(["opt-in", "sales", "upsell", "downsell", "confirmation", "checkout", "custom"]),
    pathSlug: z.string().trim().min(1).max(80),
  }).parse(Object.fromEntries(formData));

  // Verify funnel ownership
  await prisma.funnel.findFirstOrThrow({ where: { id: input.funnelId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await prisma.funnelPage.update({
    where: { id: input.pageId, funnelId: input.funnelId },
    data: { name: input.name, type: input.type, pathSlug: input.pathSlug },
  });
  revalidatePath(`/sites/funnels/${input.funnelId}`);
}

export async function deleteFunnelStep(formData: FormData) {
  const user = await requireWritable();
  const pageId = z.string().uuid().parse(String(formData.get("pageId") ?? ""));
  const funnelId = z.string().uuid().parse(String(formData.get("funnelId") ?? ""));
  await prisma.funnel.findFirstOrThrow({ where: { id: funnelId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await prisma.funnelPage.delete({ where: { id: pageId, funnelId } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "DELETE", entityType: "FunnelPage", entityId: pageId });
  revalidatePath(`/sites/funnels/${funnelId}`);
}

export async function reorderFunnelSteps(funnelId: string, orderedIds: string[]) {
  const user = await requireWritable();
  await prisma.funnel.findFirstOrThrow({ where: { id: funnelId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await Promise.all(orderedIds.map((id, idx) =>
    prisma.funnelPage.update({ where: { id, funnelId }, data: { order: idx } })
  ));
  revalidatePath(`/sites/funnels/${funnelId}`);
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export async function createForm(formData: FormData) {
  const user = await requireWritable();
  const name = z.string().trim().min(2).max(120).parse(String(formData.get("name") ?? ""));
  const form = await prisma.siteForm.create({
    data: { agencyId: user.agencyId, subAccountId: user.subAccountId, name },
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "SiteForm", entityId: form.id });
  redirect(`/sites/forms/${form.id}`);
}

export async function deleteForm(formData: FormData) {
  const user = await requireWritable();
  const formId = z.string().uuid().parse(String(formData.get("formId") ?? ""));
  await prisma.siteForm.delete({ where: { id: formId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  revalidatePath("/sites");
  redirect("/sites?tab=forms");
}

export async function saveFormFields(formId: string, fields: unknown[], settings: Record<string, unknown>) {
  const user = await requireWritable();
  await prisma.siteForm.findFirstOrThrow({ where: { id: formId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await prisma.siteForm.update({ where: { id: formId }, data: { fields: fields as never, settings: settings as never } });
  revalidatePath(`/sites/forms/${formId}`);
  revalidatePath("/sites");
}

export async function renameForm(formData: FormData) {
  const user = await requireWritable();
  const formId = z.string().uuid().parse(String(formData.get("formId") ?? ""));
  const name = z.string().trim().min(2).max(120).parse(String(formData.get("name") ?? ""));
  await prisma.siteForm.findFirstOrThrow({ where: { id: formId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await prisma.siteForm.update({ where: { id: formId }, data: { name } });
  revalidatePath(`/sites/forms/${formId}`);
}

// ─── Surveys ──────────────────────────────────────────────────────────────────

export async function createSurvey(formData: FormData) {
  const user = await requireWritable();
  const name = z.string().trim().min(2).max(120).parse(String(formData.get("name") ?? ""));
  const survey = await prisma.survey.create({
    data: { agencyId: user.agencyId, subAccountId: user.subAccountId, name },
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Survey", entityId: survey.id });
  redirect(`/sites/surveys/${survey.id}`);
}

export async function deleteSurvey(formData: FormData) {
  const user = await requireWritable();
  const surveyId = z.string().uuid().parse(String(formData.get("surveyId") ?? ""));
  await prisma.survey.delete({ where: { id: surveyId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  revalidatePath("/sites");
  redirect("/sites?tab=surveys");
}

export async function saveSurveyQuestions(surveyId: string, questions: unknown[], settings: Record<string, unknown>) {
  const user = await requireWritable();
  await prisma.survey.findFirstOrThrow({ where: { id: surveyId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await prisma.survey.update({ where: { id: surveyId }, data: { questions: questions as never, settings: settings as never } });
  revalidatePath(`/sites/surveys/${surveyId}`);
  revalidatePath("/sites");
}

// ─── Blog Posts ───────────────────────────────────────────────────────────────

export async function createBlogPost(formData: FormData) {
  const user = await requireWritable();
  const input = z.object({
    title: z.string().trim().min(2).max(200),
    slug: z.string().trim().min(2).max(200),
    author: z.string().trim().max(80).optional(),
    category: z.string().trim().max(80).optional(),
  }).parse(Object.fromEntries(formData));

  const post = await prisma.blogPost.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      title: input.title,
      slug: input.slug,
      author: input.author || null,
      category: input.category || null,
    },
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "BlogPost", entityId: post.id });
  redirect(`/sites/blog/${post.id}`);
}

export async function deleteBlogPost(formData: FormData) {
  const user = await requireWritable();
  const postId = z.string().uuid().parse(String(formData.get("postId") ?? ""));
  await prisma.blogPost.delete({ where: { id: postId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  revalidatePath("/sites");
  redirect("/sites?tab=blog");
}

export async function saveBlogPost(postId: string, data: { title: string; content: string; excerpt?: string; status?: string; category?: string; tags?: string[]; seoTitle?: string; seoDesc?: string }) {
  const user = await requireWritable();
  await prisma.blogPost.findFirstOrThrow({ where: { id: postId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await prisma.blogPost.update({
    where: { id: postId },
    data: {
      title: data.title,
      content: data.content,
      excerpt: data.excerpt || null,
      status: data.status || "draft",
      category: data.category || null,
      tags: data.tags ?? [],
      seoTitle: data.seoTitle || null,
      seoDesc: data.seoDesc || null,
      publishedAt: data.status === "published" ? new Date() : null,
    },
  });
  revalidatePath(`/sites/blog/${postId}`);
  revalidatePath("/sites");
}
