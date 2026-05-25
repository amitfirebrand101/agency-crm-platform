import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SCHEMA, PageSchemaZ, type PageSchema } from "@/lib/sites/schema";
import { SiteRenderer } from "@/lib/sites/render";
import { publishPage } from "@/app/(dashboard)/sites/[siteId]/pages/[pageId]/builder/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PreviewPage({
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
    if (parsed.success) schema = parsed.data;
  }

  async function publish() {
    "use server";
    await publishPage(pageId);
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-2.5">
        <Link
          href={`/sites/${siteId}/pages/${pageId}/builder`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
        >
          <ArrowLeft size={15} /> Back to Builder
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            Previewing <span className="font-medium text-foreground">{page.title}</span>
            {latest ? ` · ${latest.status}` : " · no version"}
          </span>
          <form action={publish}>
            <SubmitButton
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              pendingText="Publishing…"
            >
              Publish
            </SubmitButton>
          </form>
        </div>
      </header>

      <SiteRenderer schema={schema} />
    </div>
  );
}
