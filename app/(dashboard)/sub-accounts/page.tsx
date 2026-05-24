import { Building2, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createSubAccount } from "@/app/(dashboard)/sub-accounts/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SubAccountWithCounts = Prisma.SubAccountGetPayload<{
  include: { _count: { select: { contacts: true; members: true; phoneNumbers: true } } };
}>;

export default async function SubAccountsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let subAccounts: SubAccountWithCounts[] = [];

  try {
    subAccounts = await prisma.subAccount.findMany({
      where: { agencyId: user.agencyId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            contacts: true,
            members: true,
            phoneNumbers: true
          }
        }
      }
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Sub accounts page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sub accounts</h1>
        <p className="mt-1 text-sm text-muted">
          Client locations live under the agency and isolate contacts, conversations, calendars, numbers, sites, and campaigns.
        </p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 md:grid-cols-2">
          {subAccounts.map((subAccount) => (
            <Card key={subAccount.id}>
              <CardBody>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h2 className="font-semibold">{subAccount.name}</h2>
                      <p className="text-sm text-muted">/{subAccount.slug}</p>
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md border border-border bg-background p-3">
                    <dt className="text-muted">Contacts</dt>
                    <dd className="mt-1 font-semibold">{subAccount._count.contacts}</dd>
                  </div>
                  <div className="rounded-md border border-border bg-background p-3">
                    <dt className="text-muted">Users</dt>
                    <dd className="mt-1 font-semibold">{subAccount._count.members}</dd>
                  </div>
                  <div className="rounded-md border border-border bg-background p-3">
                    <dt className="text-muted">Numbers</dt>
                    <dd className="mt-1 font-semibold">{subAccount._count.phoneNumbers}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="text-primary" size={18} />
              <h2 className="font-semibold">New sub account</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createSubAccount} className="space-y-3">
              <Field label="Name" name="name" placeholder="Acme Dental" required />
              <Field label="Slug" name="slug" placeholder="acme-dental" required />
              <Field label="City" name="city" />
              <Field label="State/region" name="region" />
              <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" pendingText="Creating…">
                Create sub account
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
