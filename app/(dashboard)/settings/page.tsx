import { KeyRound, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const user = await requireUser();
  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: user.agencyId },
    include: {
      members: {
        include: { user: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Security-first agency administration for auth, roles, tenant defaults, and audit-ready operations.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardBody>
            <SlidersHorizontal className="mb-4 text-primary" size={20} />
            <div className="font-semibold">{agency.name}</div>
            <div className="mt-1 text-sm text-muted">{agency.slug}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <ShieldCheck className="mb-4 text-primary" size={20} />
            <div className="font-semibold">{agency.country}</div>
            <div className="mt-1 text-sm text-muted">Region</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <KeyRound className="mb-4 text-primary" size={20} />
            <div className="font-semibold">Supabase Auth</div>
            <div className="mt-1 text-sm text-muted">Google enabled next</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <UsersRound className="mb-4 text-primary" size={20} />
            <div className="font-semibold">{agency.members.length}</div>
            <div className="mt-1 text-sm text-muted">Agency members</div>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Agency members</h2>
        </CardHeader>
        <CardBody>
          <div className="divide-y divide-border">
            {agency.members.map((member) => (
              <div className="flex items-center justify-between gap-4 py-3" key={member.id}>
                <div>
                  <div className="font-medium">{member.user.name ?? member.user.email}</div>
                  <div className="text-sm text-muted">{member.user.email}</div>
                </div>
                <span className="rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted">{member.role}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
