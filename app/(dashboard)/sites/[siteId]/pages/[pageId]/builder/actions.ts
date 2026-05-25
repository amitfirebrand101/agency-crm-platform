"use server";

import { revalidatePath } from "next/cache";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { validatePageSchema } from "@/lib/sites/schema";

async function requireOwnedPage(pageId: string) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to edit pages.");
  }
  const page = await prisma.sitePage.findFirstOrThrow({
    where: { id: pageId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  return { user: user as typeof user & { subAccountId: string }, page };
}

export async function savePageDraft(pageId: string, schema: unknown): Promise<void> {
  const { user, page } = await requireOwnedPage(pageId);

  // Throws if the schema is invalid.
  const validated = validatePageSchema(schema);

  const latest = await prisma.sitePageVersion.findFirst({
    where: { pageId: page.id },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true, status: true, id: true },
  });

  if (latest && latest.status === "draft") {
    // Overwrite the existing draft in place.
    await prisma.sitePageVersion.update({
      where: { id: latest.id },
      data: { schema: validated },
    });
  } else {
    await prisma.sitePageVersion.create({
      data: {
        pageId: page.id,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        status: "draft",
        schema: validated,
      },
    });
  }

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "SitePage", entityId: page.id });
  revalidatePath(`/sites/${page.siteId}/pages/${page.id}/builder`);
  revalidatePath(`/sites/${page.siteId}`);
}

export async function publishPage(pageId: string): Promise<void> {
  const { user, page } = await requireOwnedPage(pageId);

  const draft = await prisma.sitePageVersion.findFirst({
    where: { pageId: page.id },
    orderBy: { versionNumber: "desc" },
  });

  if (!draft) {
    throw new Error("There is nothing to publish yet. Save a draft first.");
  }

  // Validate the stored schema before publishing.
  validatePageSchema(draft.schema);

  await prisma.$transaction([
    // Demote any previously published versions.
    prisma.sitePageVersion.updateMany({
      where: { pageId: page.id, status: "published" },
      data: { status: "archived" },
    }),
    prisma.sitePageVersion.update({
      where: { id: draft.id },
      data: { status: "published", publishedAt: new Date() },
    }),
    prisma.sitePage.update({
      where: { id: page.id },
      data: { status: "published" },
    }),
  ]);

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "SitePage", entityId: page.id, metadata: { event: "publish" } });
  revalidatePath(`/sites/${page.siteId}/pages/${page.id}/builder`);
  revalidatePath(`/sites/${page.siteId}`);
  revalidatePath(`/p/${page.siteId}/${page.slug}`);
}
