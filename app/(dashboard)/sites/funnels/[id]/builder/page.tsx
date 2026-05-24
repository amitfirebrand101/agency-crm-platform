import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageBuilder } from "./page-builder";

export default async function BuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id: funnelId } = await params;
  const { page: pageId } = await searchParams;

  const user = await requireUser();

  let funnel = null;
  let page = null;
  let forms: { id: string; name: string }[] = [];

  try {
    funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      include: { pages: { orderBy: { order: "asc" } } },
    });

    if (funnel) {
      const targetId = pageId ?? funnel.pages[0]?.id;
      if (targetId) {
        page = funnel.pages.find((p) => p.id === targetId) ?? funnel.pages[0] ?? null;
      }
    }

    forms = await prisma.siteForm.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch {}

  if (!funnel) {
    return (
      <div className="p-8">
        <Link href="/sites" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={14} /> Back to Sites
        </Link>
        <p className="mt-4 text-muted">Funnel not found.</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-8">
        <Link href={`/sites/funnels/${funnelId}`} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={14} /> Back to Funnel
        </Link>
        <p className="mt-4 text-muted">
          No pages in this funnel yet.{" "}
          <Link href={`/sites/funnels/${funnelId}`} className="text-primary underline">Add a step first.</Link>
        </p>
      </div>
    );
  }

  return (
    <PageBuilder
      funnelId={funnelId}
      funnelName={funnel.name}
      pages={funnel.pages.map((p) => ({ id: p.id, name: p.name, type: p.type }))}
      activePage={{ id: page.id, name: page.name, type: page.type, content: page.content }}
      availableForms={forms}
    />
  );
}
