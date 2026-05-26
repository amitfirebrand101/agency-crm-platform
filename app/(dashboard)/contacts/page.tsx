import Link from "next/link";
import { Search, Tags, Upload, UserRound } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createCustomField, createTag } from "@/app/(dashboard)/contacts/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContactTable } from "./contact-table";
import { Pagination } from "./pagination";
import { CreateContactForm } from "./create-contact-form";
import { LifecycleBar } from "./lifecycle-bar";
import { SmartListSidebar } from "./smart-list-sidebar";
import { listSmartLists } from "./smart-list-actions";
import type { SmartListFilters } from "./smart-list-actions";

export const dynamic = "force-dynamic";

type ContactWithRelations = Prisma.ContactGetPayload<{
  include: {
    tags: { include: { tag: { select: { id: true; name: true; color: true } } } };
    conversations: { orderBy: { createdAt: "desc" }; take: 1; select: { createdAt: true } };
    appointments: { orderBy: { createdAt: "desc" }; take: 1; select: { createdAt: true } };
    assignedUser: { select: { id: true; name: true; email: true } };
  };
}>;

function relTime(d: Date | null): string {
  if (!d) return "Never";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

const PAGE_SIZE = 50;

export default async function ContactsPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; page?: string; segment?: string; scoreMin?: string; scoreMax?: string; source?: string }>;
}) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const statusFilter = params?.status ?? "";
  const page = Math.max(1, parseInt(params?.page ?? "1", 10) || 1);
  const activeSegmentId = params?.segment ?? "";
  const scoreMin = params?.scoreMin ? parseInt(params.scoreMin, 10) : undefined;
  const scoreMax = params?.scoreMax ? parseInt(params.scoreMax, 10) : undefined;
  const sourceFilter = params?.source ?? "";

  const user = await requireUser();
  let databaseUnavailable = false;
  let contacts: ContactWithRelations[] = [];
  let tags: Awaited<ReturnType<typeof prisma.tag.findMany>> = [];
  let customFields: Awaited<ReturnType<typeof prisma.customField.findMany>> = [];
  let totalContacts = 0;
  let filteredCount = 0;
  let leadsCount = 0;
  let customersCount = 0;
  let inactiveCount = 0;
  let smartLists: Awaited<ReturnType<typeof listSmartLists>>["lists"] = [];

  const currentFilters: SmartListFilters = {
    ...(statusFilter ? { status: statusFilter as SmartListFilters["status"] } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(scoreMin !== undefined ? { scoreMin } : {}),
    ...(scoreMax !== undefined ? { scoreMax } : {}),
  };

  try {
    const baseWhere: Prisma.ContactWhereInput = {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined
    };

    const where: Prisma.ContactWhereInput = {
      ...baseWhere,
      ...(statusFilter ? { status: statusFilter as Prisma.EnumContactStatusFilter } : {}),
      ...(sourceFilter ? { source: { contains: sourceFilter, mode: "insensitive" } } : {}),
      ...(scoreMin !== undefined || scoreMax !== undefined
        ? { score: { ...(scoreMin !== undefined ? { gte: scoreMin } : {}), ...(scoreMax !== undefined ? { lte: scoreMax } : {}) } }
        : {}),
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { companyName: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const skip = (page - 1) * PAGE_SIZE;

    const [
      fetchedContacts, fetchedTags, fetchedCustomFields,
      total, filtered, leads, customers, inactive, smartListResult
    ] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: PAGE_SIZE + 1,
        include: {
          tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
          conversations: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
          appointments: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.tag.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { name: "asc" }
      }),
      prisma.customField.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { name: "asc" }
      }),
      prisma.contact.count({ where: baseWhere }),
      prisma.contact.count({ where }),
      prisma.contact.count({ where: { ...baseWhere, status: "LEAD" } }),
      prisma.contact.count({ where: { ...baseWhere, status: "CUSTOMER" } }),
      prisma.contact.count({ where: { ...baseWhere, status: "INACTIVE" } }),
      listSmartLists(),
    ]);

    contacts = fetchedContacts;
    tags = fetchedTags;
    customFields = fetchedCustomFields;
    totalContacts = total;
    filteredCount = filtered;
    leadsCount = leads;
    customersCount = customers;
    inactiveCount = inactive;
    smartLists = smartListResult.lists;
  } catch (error) {
    databaseUnavailable = true;
    console.error("Contacts page database query failed", error);
  }

  // Determine if there's a next page (fetched PAGE_SIZE + 1 records)
  const hasMore = contacts.length > PAGE_SIZE;
  const pageContacts = hasMore ? contacts.slice(0, PAGE_SIZE) : contacts;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  // Range string for display
  const rangeStart = filteredCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredCount);

  // Params forwarded to the pagination component (excludes `page`)
  const filterParams: Record<string, string> = {};
  if (query) filterParams.q = query;
  if (statusFilter) filterParams.status = statusFilter;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <p className="mt-1 text-sm text-muted">
          Tenant-scoped CRM records with tags, custom fields, source attribution, and per-contact timelines.
        </p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Lifecycle bar */}
      <LifecycleBar
        leadCount={leadsCount}
        customerCount={customersCount}
        inactiveCount={inactiveCount}
        activeStatus={statusFilter}
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total Contacts</p>
          <p className="mt-1 text-2xl font-bold">{totalContacts}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Leads</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{leadsCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Customers</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{customersCount}</p>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <UserRound className="text-primary" size={18} />
                  <h2 className="font-semibold">Contact records</h2>
                  <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                    {filteredCount}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form className="flex flex-wrap items-center gap-2" method="GET">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
                      <input
                        className="h-9 w-52 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none ring-primary/20 focus:ring-4"
                        defaultValue={query}
                        name="q"
                        placeholder="Search contacts…"
                      />
                    </div>
                    <select
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                      defaultValue={statusFilter}
                      name="status"
                    >
                      <option value="">All statuses</option>
                      <option value="LEAD">Lead</option>
                      <option value="CUSTOMER">Customer</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                    <SubmitButton className="h-9 rounded-md border border-border px-3 text-sm font-medium" pendingText="Filtering…">
                      Filter
                    </SubmitButton>
                  </form>
                  <Link
                    href="/contacts/import"
                    className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-background transition"
                  >
                    <Upload size={14} />
                    Import
                  </Link>
                </div>
              </div>
            </CardHeader>

            {pageContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-background">
                  <UserRound className="text-muted" size={28} />
                </div>
                <p className="text-base font-semibold">
                  {query || statusFilter ? "No contacts match your filter" : "No contacts yet"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {query || statusFilter
                    ? "Try adjusting your search or clearing the filter."
                    : "Add your first contact using the form on the right."}
                </p>
              </div>
            ) : (
              <>
                <div className="px-0">
                  <ContactTable
                    contacts={pageContacts.map((c) => {
                      const lastConvDate = c.conversations[0]?.createdAt ?? null;
                      const lastApptDate = c.appointments[0]?.createdAt ?? null;
                      const lastActivityDate =
                        lastConvDate && lastApptDate
                          ? lastConvDate > lastApptDate
                            ? lastConvDate
                            : lastApptDate
                          : lastConvDate ?? lastApptDate;
                      return {
                        id: c.id,
                        firstName: c.firstName,
                        lastName: c.lastName,
                        email: c.email,
                        phone: c.phone,
                        companyName: c.companyName,
                        status: c.status,
                        score: c.score,
                        createdAt: c.createdAt.toISOString(),
                        tags: c.tags.map((ct) => ({ tag: ct.tag })),
                        lastActivity: relTime(lastActivityDate),
                        assignedUser: c.assignedUser
                          ? { id: c.assignedUser.id, name: c.assignedUser.name, email: c.assignedUser.email }
                          : null,
                      };
                    })}
                    tags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
                  />
                </div>

                {/* Pagination footer */}
                <div className="flex flex-col gap-1 border-t border-border">
                  {filteredCount > 0 && (
                    <p className="px-4 pt-3 text-xs text-muted text-center">
                      Showing {rangeStart}–{rangeEnd} of {filteredCount} contact{filteredCount !== 1 ? "s" : ""}
                    </p>
                  )}
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    basePath="/contacts"
                    params={filterParams}
                  />
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <SmartListSidebar
            lists={smartLists}
            currentFilters={currentFilters}
            activeSegmentId={activeSegmentId}
          />
          <CreateContactForm />

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tags className="text-primary" size={18} />
                <h2 className="font-semibold">Tags</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createTag} className="grid grid-cols-[1fr_4rem] gap-2">
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                  name="name"
                  placeholder="Tag name"
                  required
                />
                <input
                  className="h-10 rounded-md border border-border bg-background p-1"
                  defaultValue="#0e7490"
                  name="color"
                  type="color"
                />
                <SubmitButton
                  className="col-span-2 rounded-md border border-border px-3 py-2 text-sm font-semibold transition hover:bg-background"
                  pendingText="Adding…"
                >
                  Add tag
                </SubmitButton>
              </form>
              {tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                      key={tag.id}
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Custom fields</h2>
            </CardHeader>
            <CardBody>
              <form action={createCustomField} className="space-y-3">
                <Field label="Label" name="name" placeholder="Lead budget" required />
                <Field label="Key" name="key" placeholder="lead-budget" required />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Type</span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue="TEXT"
                    name="type"
                  >
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="DATE">Date</option>
                    <option value="SELECT">Select</option>
                    <option value="BOOLEAN">Boolean</option>
                    <option value="URL">URL</option>
                  </select>
                </label>
                <SubmitButton
                  className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold transition hover:bg-background"
                  pendingText="Adding…"
                >
                  Add field
                </SubmitButton>
              </form>
              {customFields.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {customFields.map((field) => (
                    <div
                      className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm"
                      key={field.id}
                    >
                      <span>{field.name}</span>
                      <span className="text-xs font-semibold text-muted">{field.type}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
