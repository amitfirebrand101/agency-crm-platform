import Link from "next/link";
import {
  CreditCard,
  Globe,
  Share2,
  Webhook,
  ArrowRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptObject } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ConnectionStatus =
  | { connected: false }
  | { connected: true; detail?: string };

// ─────────────────────────────────────────────────────────────────────────────
// Data fetching helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getStripeStatus(
  agencyId: string,
  subAccountId: string | null
): Promise<ConnectionStatus> {
  try {
    const cred = await prisma.providerCredential.findUnique({
      where: {
        agencyId_subAccountId_provider: {
          agencyId,
          subAccountId: subAccountId ?? "",
          provider: "stripe_connect",
        },
      },
    });
    if (!cred) return { connected: false };

    let detail: string | undefined;
    try {
      const data = decryptObject<{ stripeAccountId?: string; accountId?: string }>(cred);
      detail = data.stripeAccountId ?? data.accountId;
    } catch {
      // Decryption failed — credential exists but unreadable; show generic "Connected"
    }
    return { connected: true, detail };
  } catch {
    return { connected: false };
  }
}

async function getGoogleCalendarStatus(userId: string): Promise<ConnectionStatus> {
  try {
    const token = await prisma.userOAuthToken.findUnique({
      where: { userId_provider: { userId, provider: "google_calendar" } },
    });
    if (!token) return { connected: false };

    const meta = token.metadata as Record<string, unknown>;
    const email = typeof meta?.email === "string" ? meta.email : undefined;
    return { connected: true, detail: email };
  } catch {
    return { connected: false };
  }
}

async function getFacebookStatus(
  agencyId: string,
  subAccountId: string | null
): Promise<ConnectionStatus> {
  try {
    const cred = await prisma.providerCredential.findUnique({
      where: {
        agencyId_subAccountId_provider: {
          agencyId,
          subAccountId: subAccountId ?? "",
          provider: "facebook",
        },
      },
    });
    if (!cred) return { connected: false };

    let detail: string | undefined;
    try {
      const data = decryptObject<{ pageName?: string; page_name?: string }>(cred);
      detail = data.pageName ?? data.page_name;
    } catch {
      // Decryption failed — credential exists but unreadable; show generic "Connected"
    }
    return { connected: true, detail };
  } catch {
    return { connected: false };
  }
}

async function getWebhookApiKeyCounts(
  agencyId: string,
  subAccountId: string | null
): Promise<{ webhooks: number; apiKeys: number }> {
  try {
    const [webhooks, apiKeys] = await Promise.all([
      prisma.webhookEndpoint.count({
        where: subAccountId
          ? { agencyId, subAccountId }
          : { agencyId },
      }),
      prisma.apiKey.count({
        where: {
          agencyId,
          revokedAt: null,
          ...(subAccountId ? { subAccountId } : {}),
        },
      }),
    ]);
    return { webhooks, apiKeys };
  } catch {
    return { webhooks: 0, apiKeys: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <Badge variant="success" className="flex items-center gap-1">
        <CheckCircle2 size={11} />
        Connected
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className="flex items-center gap-1">
      <Circle size={11} />
      Not configured
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration Card
// ─────────────────────────────────────────────────────────────────────────────

type IntegrationCardProps = {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: ConnectionStatus;
  cta: string;
  href: string;
};

function IntegrationCard({
  icon,
  name,
  description,
  status,
  cta,
  href,
}: IntegrationCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
              {icon}
            </div>
            <div>
              <h3 className="font-semibold">{name}</h3>
              <p className="text-xs text-muted">{description}</p>
            </div>
          </div>
          <StatusBadge connected={status.connected} />
        </div>
      </CardHeader>
      <CardBody>
        {status.connected && status.detail ? (
          <p className="mb-3 truncate text-sm text-muted">{status.detail}</p>
        ) : !status.connected ? (
          <p className="mb-3 text-sm text-muted">
            No credentials saved. Click below to connect.
          </p>
        ) : (
          <p className="mb-3 text-sm text-muted">Integration is active.</p>
        )}
        <Link
          href={href as never}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-background"
        >
          {cta}
          <ArrowRight size={12} />
        </Link>
      </CardBody>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhooks & API Keys card (always-available, counts only)
// ─────────────────────────────────────────────────────────────────────────────

function DeveloperCard({
  webhooks,
  apiKeys,
}: {
  webhooks: number;
  apiKeys: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
              <Webhook size={18} />
            </div>
            <div>
              <h3 className="font-semibold">Webhooks &amp; API Keys</h3>
              <p className="text-xs text-muted">
                Outbound webhooks and programmatic access tokens
              </p>
            </div>
          </div>
          <Badge variant="info">Available</Badge>
        </div>
      </CardHeader>
      <CardBody>
        <div className="mb-3 flex gap-4 text-sm">
          <span className="text-muted">
            <span className="font-semibold text-foreground">{webhooks}</span>{" "}
            webhook endpoint{webhooks !== 1 ? "s" : ""}
          </span>
          <span className="text-muted">
            <span className="font-semibold text-foreground">{apiKeys}</span>{" "}
            active API key{apiKeys !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={"/webhooks" as never}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-background"
          >
            Manage Webhooks
            <ArrowRight size={12} />
          </Link>
          <Link
            href={"/api-keys" as never}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-background"
          >
            Manage API Keys
            <ArrowRight size={12} />
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function IntegrationsPage() {
  const user = await requireUser();

  const [stripe, googleCal, facebook, devCounts] = await Promise.all([
    getStripeStatus(user.agencyId, user.subAccountId),
    getGoogleCalendarStatus(user.id),
    getFacebookStatus(user.agencyId, user.subAccountId),
    getWebhookApiKeyCounts(user.agencyId, user.subAccountId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="mt-1 text-sm text-muted">
          Connect third-party services to your agency account.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <IntegrationCard
          icon={<CreditCard size={18} />}
          name="Stripe"
          description="Accept payments, subscriptions, and invoices"
          status={stripe}
          cta="Configure Stripe"
          href="/settings/integrations/stripe"
        />

        <IntegrationCard
          icon={<Globe size={18} />}
          name="Google Calendar"
          description="Sync bookings and appointments with Google Calendar"
          status={googleCal}
          cta="Configure Google"
          href="/settings/integrations/google"
        />

        <IntegrationCard
          icon={<Share2 size={18} />}
          name="Facebook Lead Ads"
          description="Capture leads directly from Facebook ad forms"
          status={facebook}
          cta="Configure Facebook"
          href="/settings/integrations/facebook"
        />

        <DeveloperCard webhooks={devCounts.webhooks} apiKeys={devCounts.apiKeys} />
      </div>
    </div>
  );
}
