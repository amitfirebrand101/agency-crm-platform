import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageSchemaZ, type PageSchema } from "@/lib/sites/schema";
import { SiteRenderer } from "@/lib/sites/render";

export const dynamic = "force-dynamic";

async function loadPublishedPage(siteId: string, slug: string) {
  const page = await prisma.sitePage.findFirst({
    where: { siteId, slug, status: "published", site: { status: { not: "archived" } } },
    include: {
      versions: {
        where: { status: "published" },
        orderBy: { publishedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!page || page.versions.length === 0) return null;
  return page;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteId: string; slug: string }>;
}): Promise<Metadata> {
  const { siteId, slug } = await params;
  try {
    const page = await loadPublishedPage(siteId, slug);
    if (!page) return { title: "Not found" };
    return {
      title: page.seoTitle || page.title,
      description: page.seoDescription || undefined,
      openGraph: {
        title: page.seoTitle || page.title,
        description: page.seoDescription || undefined,
        type: "website",
      },
    };
  } catch {
    return { title: "Not found" };
  }
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ siteId: string; slug: string }>;
}) {
  const { siteId, slug } = await params;

  let page: Awaited<ReturnType<typeof loadPublishedPage>> = null;
  try {
    page = await loadPublishedPage(siteId, slug);
  } catch (err) {
    console.error("Public page query failed", err);
  }

  if (!page) {
    notFound();
  }

  const parsed = PageSchemaZ.safeParse(page.versions[0].schema);
  if (!parsed.success) {
    notFound();
  }
  const schema: PageSchema = parsed.data;

  return <SiteRenderer schema={schema} />;
}
