import { notFound } from "next/navigation";
import { WorkflowBuilder } from "@/app/(dashboard)/automations/[id]/builder";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function AutomationBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();

  const [automation, contacts] = await Promise.all([
    prisma.automation.findFirst({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined }
    }),
    prisma.contact.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, firstName: true, lastName: true, email: true }
    })
  ]);

  if (!automation) notFound();

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  return (
    <WorkflowBuilder
      appUrl={appUrl}
      automation={{
        id: automation.id,
        name: automation.name,
        status: automation.status,
        definition: automation.definition
      }}
      contacts={contacts}
    />
  );
}
