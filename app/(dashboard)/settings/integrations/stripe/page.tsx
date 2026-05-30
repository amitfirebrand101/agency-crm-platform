import { CheckCircle2, ExternalLink, Link2, XCircle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripeConfigured, getConnectCredential } from "@/lib/stripe";
import {
  disconnectStripe,
  createPaymentLink,
  deletePaymentLink,
} from "@/app/(dashboard)/settings/integrations/stripe/actions";

export const dynamic = "force-dynamic";

export default async function StripeIntegrationPage({
  searchParams,
}: {
  searchParams?: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user   = await requireUser();

  const isConfigured = stripeConfigured();

  // If the server-side env vars aren't present at all, show a setup notice
  if (!isConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Stripe Integration</h1>
          <p className="mt-1 text-sm text-muted">
            Accept payments, manage subscriptions, and create payment links.
          </p>
        </div>

        <Card>
          <CardBody>
            <div className="flex items-start gap-4 py-2">
              <XCircle className="mt-0.5 shrink-0 text-amber-500" size={20} />
              <div>
                <p className="font-semibold">Stripe is not configured</p>
                <p className="mt-1 text-sm text-muted">
                  Add <code className="rounded bg-background px-1 font-mono text-xs">STRIPE_SECRET_KEY</code>,{" "}
                  <code className="rounded bg-background px-1 font-mono text-xs">STRIPE_CONNECT_CLIENT_ID</code>, and{" "}
                  <code className="rounded bg-background px-1 font-mono text-xs">STRIPE_WEBHOOK_SECRET</code>{" "}
                  to your environment variables to enable the Stripe integration.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Load connection status and payment links
  const [credential, paymentLinks] = await Promise.all([
    getConnectCredential(user.agencyId, user.subAccountId),
    prisma.paymentLink.findMany({
      where: {
        agencyId:     user.agencyId,
        subAccountId: user.subAccountId ?? "",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const isConnected = !!credential;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Stripe Integration</h1>
        <p className="mt-1 text-sm text-muted">
          Accept payments, manage subscriptions, and create shareable payment links.
        </p>
      </div>

      {/* Flash messages */}
      {params?.connected === "1" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={16} />
          Stripe account connected successfully.
        </div>
      )}
      {params?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle size={16} />
          {params.error === "not_configured"
            ? "Stripe Connect is not configured. Check your STRIPE_CONNECT_CLIENT_ID env var."
            : "Failed to connect Stripe account. Please try again."}
        </div>
      )}

      {/* Connection status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="text-primary" size={16} />
            <h2 className="font-semibold">Connection</h2>
          </div>
        </CardHeader>
        <CardBody>
          {isConnected ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-green-500" size={20} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Connected</span>
                    <Badge variant={credential.livemode ? "success" : "warning"}>
                      {credential.livemode ? "Live" : "Test"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {credential.stripeAccountId}
                  </p>
                </div>
              </div>
              <form action={disconnectStripe}>
                <SubmitButton
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition"
                  pendingText="Disconnecting…"
                >
                  Disconnect
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 shrink-0 text-muted" size={20} />
                <div>
                  <span className="font-semibold">Not connected</span>
                  <p className="mt-0.5 text-sm text-muted">
                    Connect your Stripe account to start accepting payments.
                  </p>
                </div>
              </div>
              <a
                href="/api/oauth/stripe/start"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Connect Stripe
              </a>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create payment link — only shown when connected */}
      {isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="text-primary" size={16} />
              <h2 className="font-semibold">Create Payment Link</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createPaymentLink} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Name"
                  name="name"
                  placeholder="e.g. Monthly Retainer"
                  required
                />
                <Field
                  label="Description (optional)"
                  name="description"
                  placeholder="Short description shown to customers"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Type
                    </span>
                    <select
                      name="type"
                      defaultValue="one_time"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    >
                      <option value="one_time">One-time</option>
                      <option value="subscription">Subscription (monthly)</option>
                    </select>
                  </label>
                </div>

                <Field
                  label="Amount (cents)"
                  name="amountCents"
                  type="number"
                  placeholder="e.g. 9900 = $99.00"
                  required
                />

                <div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Currency
                    </span>
                    <select
                      name="currency"
                      defaultValue="USD"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                    </select>
                  </label>
                </div>
              </div>

              <SubmitButton
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Creating…"
              >
                Create Payment Link
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Payment links list */}
      {paymentLinks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="text-primary" size={16} />
              <h2 className="font-semibold">Payment Links</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {paymentLinks.length}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-border">
              {paymentLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{link.name}</span>
                      <Badge variant={link.active ? "success" : "muted"}>
                        {link.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="info">
                        {link.type === "subscription" ? "Subscription" : "One-time"}
                      </Badge>
                    </div>
                    {link.description && (
                      <p className="mt-0.5 text-sm text-muted">{link.description}</p>
                    )}
                    <p className="mt-1 text-sm font-semibold">
                      {(link.amountCents / 100).toLocaleString("en-US", {
                        style:    "currency",
                        currency: link.currency,
                      })}
                      {link.type === "subscription" && (
                        <span className="ml-1 font-normal text-muted">/mo</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {link.stripePaymentLinkUrl && (
                      <a
                        href={link.stripePaymentLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-background transition"
                      >
                        <ExternalLink size={12} />
                        Open
                      </a>
                    )}
                    <form action={deletePaymentLink}>
                      <input type="hidden" name="id" value={link.id} />
                      <SubmitButton
                        className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 transition"
                        pendingText="Deleting…"
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {isConnected && paymentLinks.length === 0 && (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
          No payment links yet. Create one above.
        </div>
      )}
    </div>
  );
}
