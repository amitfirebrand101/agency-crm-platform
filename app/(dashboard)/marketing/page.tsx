import { Megaphone, Plus, TrendingUp } from "lucide-react";
import { createMarketingCampaign } from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MarketingPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let campaigns: Awaited<ReturnType<typeof prisma.marketingCampaign.findMany>> = [];

  try {
    campaigns = await prisma.marketingCampaign.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Marketing page database query failed", error);
  }

  const draftCount = campaigns.filter((c) => c.status === "draft").length;
  const scheduledCount = campaigns.filter((c) => c.status === "scheduled").length;
  const sentCount = campaigns.filter((c) => c.status === "sent").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Marketing</h1>
        <p className="mt-1 text-sm text-muted">
          Campaign management for email and SMS. Provider-backed sending requires integration credentials.
        </p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      {campaigns.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="text-sm text-muted">Draft</div>
            <div className="mt-1 text-2xl font-semibold">{draftCount}</div>
          </article>
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="text-sm text-muted">Scheduled</div>
            <div className="mt-1 text-2xl font-semibold">{scheduledCount}</div>
          </article>
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="text-sm text-muted">Sent</div>
            <div className="mt-1 text-2xl font-semibold">{sentCount}</div>
          </article>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="text-primary" size={18} />
              <h2 className="font-semibold">Campaigns</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">{campaigns.length}</span>
            </div>
          </CardHeader>
          <CardBody>
            {campaigns.length > 0 ? (
              <div className="divide-y divide-border">
                {campaigns.map((campaign) => (
                  <div className="flex items-center justify-between gap-4 py-3" key={campaign.id}>
                    <div>
                      <div className="font-medium">{campaign.name}</div>
                      <div className="flex items-center gap-2 text-sm text-muted">
                        <TrendingUp size={12} />
                        <span>{campaign.channel}</span>
                        <span>·</span>
                        <span>{new Date(campaign.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Megaphone className="mx-auto mb-4 text-muted" size={32} />
                <p className="font-medium">No campaigns yet</p>
                <p className="mt-1 text-sm text-muted">Create your first campaign to start reaching your contacts.</p>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">New campaign</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createMarketingCampaign} className="space-y-3">
                <Field label="Name" name="name" placeholder="Spring lead push" required />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Channel</span>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="channel">
                    <option value="Email">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="Push">Push notification</option>
                  </select>
                </label>
                <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" pendingText="Creating…">
                  Create campaign
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Provider status</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Email (SMTP/SendGrid)</span>
                  <Badge variant="warning">Not connected</Badge>
                </div>
                <div className="flex justify-between">
                  <span>SMS (Twilio/Telnyx)</span>
                  <Badge variant="warning">Not connected</Badge>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">Connect providers in Settings → Integrations to enable sending.</p>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
