import { Key, ShieldAlert } from "lucide-react";
import { generateApiKey, revokeApiKey } from "@/app/(dashboard)/api-keys/actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function keyStatus(key: { revokedAt: Date | null; expiresAt: Date | null }): {
  label: string;
  variant: "success" | "danger" | "warning";
} {
  if (key.revokedAt) return { label: "Revoked", variant: "danger" };
  if (key.expiresAt && key.expiresAt < new Date()) return { label: "Expired", variant: "warning" };
  return { label: "Active", variant: "success" };
}

const SCOPE_VARIANTS: Record<string, "info" | "warning" | "danger"> = {
  read: "info",
  write: "warning",
  admin: "danger",
};

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams?: Promise<{ newKey?: string }>;
}) {
  const params = await searchParams;
  const newKey = params?.newKey?.trim() ?? null;

  const user = await requireUser();
  let apiKeys: Awaited<ReturnType<typeof prisma.apiKey.findMany>> = [];
  let databaseUnavailable = false;

  try {
    apiKeys = await prisma.apiKey.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? null },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    databaseUnavailable = true;
    console.error("API keys page query failed", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="mt-1 text-sm text-muted">Manage API access for integrations.</p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* One-time generated key banner */}
      {newKey ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0 text-amber-700" size={18} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Copy this key now — it won&apos;t be shown again
              </p>
              <code className="mt-2 block break-all rounded bg-amber-100 px-3 py-2 font-mono text-sm text-amber-900">
                {newKey}
              </code>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Key list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="text-primary" size={17} />
              <h2 className="font-semibold">API Keys</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {apiKeys.length}
              </span>
            </div>
          </CardHeader>

          {apiKeys.length === 0 && !databaseUnavailable ? (
            <CardBody>
              <div className="py-10 text-center">
                <Key className="mx-auto mb-3 text-muted" size={32} />
                <p className="font-semibold">No API keys yet</p>
                <p className="mt-1 text-sm text-muted">Generate your first key using the form on the right.</p>
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-border">
              {apiKeys.map((k) => {
                const status = keyStatus(k);
                return (
                  <div key={k.id} className="flex items-center gap-4 px-5 py-4 hover:bg-background/50 transition">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Key size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{k.name}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="rounded bg-background px-2 py-0.5 font-mono text-xs text-muted">
                          {k.keyPrefix}...
                        </code>
                        {k.scopes.map((scope) => (
                          <Badge key={scope} variant={SCOPE_VARIANTS[scope] ?? "muted"}>
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                        <span>Created {k.createdAt.toLocaleDateString()}</span>
                        {k.lastUsedAt ? (
                          <span>Last used {k.lastUsedAt.toLocaleDateString()}</span>
                        ) : (
                          <span>Never used</span>
                        )}
                        {k.expiresAt ? (
                          <span>Expires {k.expiresAt.toLocaleDateString()}</span>
                        ) : null}
                      </div>
                    </div>
                    {!k.revokedAt ? (
                      <form action={revokeApiKey}>
                        <input type="hidden" name="id" value={k.id} />
                        <SubmitButton
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                          pendingText="Revoking…"
                        >
                          Revoke
                        </SubmitButton>
                      </form>
                    ) : (
                      <span className="text-xs text-muted">
                        Revoked {k.revokedAt.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Generate form */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Generate API Key</h2>
          </CardHeader>
          <CardBody>
            <form action={generateApiKey} className="space-y-4">
              <Field label="Name" name="name" placeholder="My Integration" required />

              <fieldset className="space-y-2">
                <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Scopes
                </legend>
                {(["read", "write", "admin"] as const).map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="scopes"
                      value={scope}
                      defaultChecked={scope === "read"}
                      className="rounded border-border text-primary"
                    />
                    <span className="capitalize">{scope}</span>
                    <span className="text-xs text-muted">
                      {scope === "read"
                        ? "— read-only access"
                        : scope === "write"
                        ? "— create & update"
                        : "— full control including deletes"}
                    </span>
                  </label>
                ))}
              </fieldset>

              <Field
                label="Expires At (optional)"
                name="expiresAt"
                type="date"
              />

              <SubmitButton
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Generating…"
              >
                Generate Key
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
