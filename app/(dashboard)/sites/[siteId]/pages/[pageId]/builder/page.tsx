import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SCHEMA, PageSchemaZ, type PageSchema } from "@/lib/sites/schema";
import { PageBuilder } from "@/components/sites/builder/page-builder";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
}) {
  const { siteId, pageId } = await params;
  const user = await requireUser();

  const page = await prisma.sitePage.findFirst({
    where: { id: pageId, siteId, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });

  if (!page) {
    notFound();
  }

  const latest = page.versions[0];
  let schema: PageSchema = DEFAULT_PAGE_SCHEMA;
  if (latest) {
    const parsed = PageSchemaZ.safeParse(latest.schema);
    if (parsed.success) {
      schema = parsed.data;
    }
  }

  return (
    <PageBuilder
      pageId={page.id}
      siteId={page.siteId}
      initialSchema={schema}
      initialTitle={page.title}
      initialSlug={page.slug}
      previewUrl={`/sites/${page.siteId}/pages/${page.id}/preview`}
      backHref={`/sites/${page.siteId}`}
    />
  );
}
