import { ExternalLink, MessageSquare, Star } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendReviewRequest, deleteReviewRequest } from "./actions";

export const dynamic = "force-dynamic";

type ReviewRequestRow = Prisma.ReviewRequestGetPayload<{
  include: { contact: { select: { firstName: true; lastName: true; phone: true; email: true } } };
}>;

type ContactOption = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

function platformVariant(platform: string): "success" | "info" | "default" {
  if (platform === "google") return "success";
  if (platform === "yelp") return "danger" as never;
  if (platform === "facebook") return "info";
  return "default";
}

function platformLabel(platform: string): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function fmtDate(d: Date | null): string {
  if (!d) return "Not sent";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + "…" : u.pathname);
  } catch {
    return url.length > 30 ? url.slice(0, 30) + "…" : url;
  }
}

export default async function ReputationPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let requests: ReviewRequestRow[] = [];
  let contacts: ContactOption[] = [];
  let totalSent = 0;
  let clickedCount = 0;
  let pendingCount = 0;

  try {
    const where = {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined,
    };

    [requests, contacts] = await Promise.all([
      prisma.reviewRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          contact: { select: { firstName: true, lastName: true, phone: true, email: true } },
        },
      }),
      prisma.contact.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        take: 200,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      }),
    ]);

    totalSent = requests.length;
    clickedCount = requests.filter((r) => r.status === "clicked").length;
    pendingCount = requests.filter((r) => r.status === "pending").length;
  } catch (err) {
    databaseUnavailable = true;
    console.error("Reputation page query failed", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reputation Management</h1>
        <p className="mt-1 text-sm text-muted">
          Send review requests to customers and track responses.
        </p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total Sent</p>
          <p className="mt-1 text-2xl font-bold">{totalSent}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Clicked</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{clickedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Left: review requests list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="text-primary" size={18} />
              <h2 className="font-semibold">Review Requests</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {requests.length}
              </span>
            </div>
          </CardHeader>

          {requests.length === 0 ? (
            <CardBody>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-background">
                  <Star className="text-muted" size={28} />
                </div>
                <p className="font-semibold">No review requests yet</p>
                <p className="mt-1 text-sm text-muted">
                  Use the form to send your first review request.
                </p>
              </div>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Platform
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Channel
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Sent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Clicked
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      Link
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-background/50 transition">
                      <td className="px-5 py-3 font-medium">
                        {req.contact.firstName} {req.contact.lastName ?? ""}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={platformVariant(req.platform)}>
                          {platformLabel(req.platform)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={req.channel === "SMS" ? "info" : "default"}>
                          {req.channel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted">{fmtDate(req.sentAt)}</td>
                      <td className="px-4 py-3 text-muted">
                        {req.clickedAt ? fmtDate(req.clickedAt) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {req.reviewUrl ? (
                          <a
                            href={req.reviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                            title={req.reviewUrl}
                          >
                            <ExternalLink size={11} />
                            {truncateUrl(req.reviewUrl)}
                          </a>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <form action={deleteReviewRequest}>
                          <input type="hidden" name="id" value={req.id} />
                          <SubmitButton
                            className="rounded border border-border px-2 py-1 text-xs text-muted hover:border-red-300 hover:text-red-600 transition"
                            pendingText="…"
                          >
                            Delete
                          </SubmitButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right: send form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="text-primary" size={18} />
              <h2 className="font-semibold">Send Review Request</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={sendReviewRequest} className="space-y-4">
              {/* Contact select */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Contact <span className="text-red-500">*</span>
                </span>
                <select
                  name="contactId"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                >
                  <option value="">Select a contact…</option>
                  {contacts.map((c) => {
                    const identifier = c.phone ?? c.email ?? "";
                    return (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName ?? ""}
                        {identifier ? ` · ${identifier}` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              {/* Platform select */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Platform <span className="text-red-500">*</span>
                </span>
                <select
                  name="platform"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                >
                  <option value="google">Google</option>
                  <option value="yelp">Yelp</option>
                  <option value="facebook">Facebook</option>
                </select>
              </label>

              {/* Channel select */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Channel <span className="text-red-500">*</span>
                </span>
                <select
                  name="channel"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                >
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                </select>
              </label>

              <Field
                label="Review URL"
                name="reviewUrl"
                type="url"
                placeholder="https://g.page/..."
              />

              <SubmitButton
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Sending…"
              >
                Send Request
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
