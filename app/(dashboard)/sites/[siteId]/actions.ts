"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { DEFAULT_PAGE_SCHEMA } from "@/lib/sites/schema";

async function requireWritable() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage sites.");
  }
  return user as typeof user & { subAccountId: string };
}

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.");

async function requireOwnedSite(user: { agencyId: string; subAccountId: string }, siteId: string) {
  return prisma.site.findFirstOrThrow({
    where: { id: siteId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
}

export async function createPage(formData: FormData) {
  const user = await requireWritable();
  const input = z
    .object({
      siteId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      slug: slugSchema,
    })
    .parse(Object.fromEntries(formData));

  const site = await requireOwnedSite(user, input.siteId);

  const existing = await prisma.sitePage.findFirst({
    where: { siteId: site.id, slug: input.slug },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`A page with slug "${input.slug}" already exists for this site.`);
  }

  const page = await prisma.sitePage.create({
    data: {
      siteId: site.id,
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      title: input.title,
      slug: input.slug,
      status: "draft",
      versions: {
        create: {
          versionNumber: 1,
          status: "draft",
          schema: DEFAULT_PAGE_SCHEMA,
        },
      },
    },
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "SitePage", entityId: page.id });
  redirect(`/sites/${site.id}/pages/${page.id}/builder`);
}

export async function updatePageSettings(formData: FormData) {
  const user = await requireWritable();
  const input = z
    .object({
      pageId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      slug: slugSchema,
      seoTitle: z.string().trim().max(200).optional(),
      seoDescription: z.string().trim().max(400).optional(),
    })
    .parse(Object.fromEntries(formData));

  const page = await prisma.sitePage.findFirstOrThrow({
    where: { id: input.pageId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });

  if (input.slug !== page.slug) {
    const clash = await prisma.sitePage.findFirst({
      where: { siteId: page.siteId, slug: input.slug, NOT: { id: page.id } },
      select: { id: true },
    });
    if (clash) throw new Error(`A page with slug "${input.slug}" already exists for this site.`);
  }

  await prisma.sitePage.update({
    where: { id: page.id },
    data: {
      title: input.title,
      slug: input.slug,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
    },
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "SitePage", entityId: page.id });
  revalidatePath(`/sites/${page.siteId}`);
}

export async function deletePage(formData: FormData) {
  const user = await requireWritable();
  const pageId = z.string().uuid().parse(String(formData.get("pageId") ?? ""));

  const page = await prisma.sitePage.findFirstOrThrow({
    where: { id: pageId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });

  await prisma.sitePage.delete({ where: { id: page.id } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "DELETE", entityType: "SitePage", entityId: page.id });
  revalidatePath(`/sites/${page.siteId}`);
}

export async function updateSiteSettings(formData: FormData) {
  const user = await requireWritable();
  const input = z
    .object({
      siteId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      domain: z.string().trim().max(200).optional(),
      status: z.enum(["draft", "published", "archived"]),
    })
    .parse(Object.fromEntries(formData));

  const site = await requireOwnedSite(user, input.siteId);

  await prisma.site.update({
    where: { id: site.id },
    data: {
      name: input.name,
      domain: input.domain || null,
      status: input.status,
    },
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Site", entityId: site.id });
  revalidatePath(`/sites/${site.id}`);
  revalidatePath("/sites");
}

export async function createSite(formData: FormData) {
  const user = await requireWritable();
  const input = z
    .object({
      name: z.string().trim().min(2).max(120),
      domain: z.string().trim().max(200).optional(),
    })
    .parse(Object.fromEntries(formData));

  const site = await prisma.site.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name: input.name,
      domain: input.domain || null,
      status: "draft",
    },
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Site", entityId: site.id });
  redirect(`/sites/${site.id}`);
}

export async function deleteSite(formData: FormData) {
  const user = await requireWritable();
  const siteId = z.string().uuid().parse(String(formData.get("siteId") ?? ""));
  await requireOwnedSite(user, siteId);
  await prisma.site.delete({ where: { id: siteId } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "DELETE", entityType: "Site", entityId: siteId });
  revalidatePath("/sites");
  redirect("/sites?tab=websites");
}
