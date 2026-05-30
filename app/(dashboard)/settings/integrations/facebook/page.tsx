import { Facebook, Plug, PlugZap, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { decryptObject } from "@/lib/crypto";
import type { EncryptedBlob } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  disconnectFacebook,
  saveFacebookLeadForm,
  deleteFacebookLeadForm,
  toggleFormActive,
} from "@/app/(dashboard)/settings/integrations/facebook/actions";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FacebookCredential = {
  userAccessToken: string;
  pageId:          string;
  pageAccessToken: string;
  pageName:        string;
  pages:           Array<{ id: string; name: string }>;
};

// CRM fields that can be mapped from Facebook lead form fields
const CRM_FIELDS = [
  { key: "email",       label: "Email" },
  { key: "phone",       label: "Phone" },
  { key: "firstName",   label: "First Name" },
  { key: "lastName",    label: "Last Name" },
  { key: "companyName", label: "Company Name" },
  { key: "source",      label: "Source (override)" },
] as const;

// Common Facebook lead form field names
const FB_FIELD_SUGGESTIONS = [
  "email",
  "phone_number",
  "first_name",
  "last_name",
  "full_name",
  "company_name",
  "job_title",
  "city",
  "state",
  "zip_code",
  "country",
  "website",
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function FacebookIntegrationPage({
  searchParams,
}: {
  searchParams?: Promise<{ connected?: string; error?: string }>;
}) {
  const params      = await searchParams;
  const justConnected = params?.connected === "1";
  const hasError      = params?.error === "1";

  const user = await requireUser();
  const subAccountId = user.subAccountId ?? "";

  // ── Fetch credential ────────────────────────────────────────────────────

  let credential: FacebookCredential | null = null;
  let dbError = false;
  let leadForms: Array<{
    id:            string;
    fbPageId:      string;
    fbFormId:      string;
    fbFormName:    string;
    fieldMappings: Record<string, string>;
    active:        boolean;
  }> = [];

  try {
    const [cred, forms] = await Promise.all([
      prisma.providerCredential.findUnique({
        where: {
          agencyId_subAccountId_provider: {
            agencyId:    user.agencyId,
            subAccountId,
            provider:    "facebook",
          },
        },
      }),
      prisma.facebookLeadForm.findMany({
        where:   { agencyId: user.agencyId, subAccountId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (cred) {
      credential = decryptObject<FacebookCredential>({
        encryptedData: cred.encryptedData,
        iv:            cred.iv,
        authTag:       cred.authTag,
      } as EncryptedBlob);
    }

    leadForms = forms.map((f) => ({
      id:            f.id,
      fbPageId:      f.fbPageId,
      fbFormId:      f.fbFormId,
      fbFormName:    f.fbFormName,
      fieldMappings: (f.fieldMappings ?? {}) as Record<string, string>,
      active:        f.active,
    }));
  } catch (err) {
    console.error("[facebook-settings] Failed to load data", err);
    dbError = true;
  }

  const isConnected = !!credential;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <Facebook className="text-[#1877F2]" size={22} />
          <h1 className="text-2xl font-semibold">Facebook Lead Ads</h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          Connect your Facebook page to automatically capture leads from your Lead Ad forms.
        </p>
      </div>

      {/* Status banners */}
      {justConnected && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Facebook page connected successfully.
        </div>
      )}
      {hasError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Something went wrong during the Facebook connection. Please try again.
        </div>
      )}
      {dbError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Unable to reach the database. Please refresh and try again.
        </div>
      )}

      {/* Connection card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {isConnected
              ? <PlugZap className="text-green-600" size={16} />
              : <Plug className="text-muted" size={16} />}
            <h2 className="font-semibold">Connection status</h2>
            <Badge variant={isConnected ? "success" : "muted"}>
              {isConnected ? "Connected" : "Not connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardBody>
          {isConnected && credential ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">{credential.pageName}</div>
                <div className="font-mono text-xs text-muted">Page ID: {credential.pageId}</div>
                {credential.pages.length > 1 && (
                  <div className="mt-1 text-xs text-muted">
                    {credential.pages.length} pages available
                  </div>
                )}
              </div>
              <form action={disconnectFacebook}>
                <SubmitButton
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                  pendingText="Disconnecting…"
                >
                  Disconnect
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-muted">
                Connect your Facebook account to start capturing leads from your ad forms.
              </p>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/oauth/facebook/start"
                className="shrink-0 rounded-md bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166fe5] transition"
              >
                Connect Facebook
              </a>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Lead forms — only shown when connected */}
      {isConnected && (
        <>
          {/* Existing forms */}
          {leadForms.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Lead forms</h2>
              </CardHeader>
              <CardBody className="p-0">
                <div className="divide-y divide-border">
                  {leadForms.map((form) => (
                    <div
                      key={form.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{form.fbFormName}</span>
                          <Badge variant={form.active ? "success" : "muted"}>
                            {form.active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted">
                          <span>Form ID: <span className="font-mono">{form.fbFormId}</span></span>
                          <span>
                            {Object.keys(form.fieldMappings).length} field mapping
                            {Object.keys(form.fieldMappings).length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {/* Toggle active */}
                        <form action={toggleFormActive}>
                          <input type="hidden" name="id" value={form.id} />
                          <SubmitButton
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-background transition"
                            pendingText="Updating…"
                          >
                            {form.active ? "Pause" : "Activate"}
                          </SubmitButton>
                        </form>
                        {/* Delete */}
                        <form action={deleteFacebookLeadForm}>
                          <input type="hidden" name="id" value={form.id} />
                          <SubmitButton
                            className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 transition"
                            pendingText="Deleting…"
                          >
                            <Trash2 size={11} />
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

          {/* Add form */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Add lead form</h2>
            </CardHeader>
            <CardBody>
              <form action={saveFacebookLeadForm} className="space-y-5">
                {/* Pass the connected page ID automatically */}
                <input type="hidden" name="fbPageId" value={credential?.pageId ?? ""} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Facebook Form ID
                    </span>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                      name="fbFormId"
                      placeholder="e.g. 123456789012345"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Form Name (for your reference)
                    </span>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                      name="fbFormName"
                      placeholder="e.g. Summer Campaign 2026"
                      required
                    />
                  </label>
                </div>

                {/* Field mapping table */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    Field Mappings — map CRM fields to Facebook form field names
                  </p>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-wide text-muted">
                          <th className="px-4 py-2.5">CRM Field</th>
                          <th className="px-4 py-2.5">Facebook Field Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {CRM_FIELDS.map(({ key, label }) => (
                          <tr key={key}>
                            <td className="px-4 py-2.5 font-medium">{label}</td>
                            <td className="px-4 py-2.5">
                              {/*
                                We embed per-field values as individual hidden inputs
                                with a fieldMappings[key] naming scheme, then assemble
                                the JSON in the action. But server actions receive
                                FormData, so we use a single JSON field built via
                                a hidden input updated by the select.
                                Simplest approach: name each select as mapping__{key}
                                and assemble in the action.
                              */}
                              <select
                                name={`mapping__${key}`}
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                                defaultValue=""
                              >
                                <option value="">— not mapped —</option>
                                {FB_FIELD_SUGGESTIONS.map((f) => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Hidden input for assembled fieldMappings JSON — populated client-side */}
                  {/*
                    Because this is a pure server component we cannot use onChange.
                    The action reads individual mapping__* fields and assembles the
                    JSON server-side. We set fieldMappings to "{}" as a fallback
                    that the action will override.
                  */}
                  <input type="hidden" name="fieldMappings" value="{}" />
                </div>

                <SubmitButton
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-60"
                  pendingText="Saving…"
                >
                  Save Form
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
