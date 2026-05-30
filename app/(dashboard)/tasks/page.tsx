import Link from "next/link";
import {
  CheckSquare,
  Square,
  Trash2,
  AlertCircle,
  ClipboardList,
  CheckCircle2,
  Clock,
  Plus,
  User,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTask, completeTask, uncompleteTask, deleteTask } from "./actions";

export const dynamic = "force-dynamic";

function formatDueDate(date: Date | null): { label: string; overdue: boolean } {
  if (!date) return { label: "", overdue: false };
  const now = new Date();
  const overdue = date < now;
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  return { label, overdue };
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return (parts[0]![0] ?? "").toUpperCase();
  }
  return email[0]!.toUpperCase();
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; contactId?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params?.status ?? "open";
  const contactIdFilter = params?.contactId ?? "";

  const user = await requireUser();
  let databaseUnavailable = false;

  type TaskRow = {
    id: string;
    title: string;
    dueDate: Date | null;
    completedAt: Date | null;
    contact: { id: string; firstName: string; lastName: string | null };
    assignedUser: { id: string; name: string | null; email: string } | null;
  };

  let tasks: TaskRow[] = [];
  let openCount = 0;
  let overdueCount = 0;
  let completedCount = 0;
  let totalCount = 0;
  let contacts: { id: string; firstName: string; lastName: string | null }[] = [];
  let members: { userId: string; user: { id: string; name: string | null; email: string } }[] = [];

  try {
    const now = new Date();

    const baseWhere = {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined,
      ...(contactIdFilter ? { contactId: contactIdFilter } : {}),
    };

    const whereFilter = {
      ...baseWhere,
      ...(statusFilter === "open" ? { completedAt: null } : {}),
      ...(statusFilter === "completed" ? { completedAt: { not: null as Date | null } } : {}),
      ...(statusFilter === "overdue" ? { completedAt: null, dueDate: { lt: now } } : {}),
    };

    [tasks, openCount, overdueCount, completedCount, totalCount, contacts, members] = await Promise.all([
      prisma.contactTask.findMany({
        where: whereFilter,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }],
        take: 100,
      }),
      prisma.contactTask.count({ where: { ...baseWhere, completedAt: null } }),
      prisma.contactTask.count({ where: { ...baseWhere, completedAt: null, dueDate: { lt: now } } }),
      prisma.contactTask.count({ where: { ...baseWhere, completedAt: { not: null } } }),
      prisma.contactTask.count({ where: baseWhere }),
      prisma.contact.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
        take: 100,
      }),
      prisma.subAccountMembership.findMany({
        where: { subAccountId: user.subAccountId ?? undefined },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Tasks page database query failed", error);
  }

  const filterTabs = [
    { label: "All", value: "all" },
    { label: "Open", value: "open" },
    { label: "Overdue", value: "overdue" },
    { label: "Completed", value: "completed" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="mt-1 text-sm text-muted">All open tasks across your contacts.</p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Open Tasks</p>
              <p className="mt-1.5 text-3xl font-bold">{openCount}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <ClipboardList className="text-blue-600" size={20} />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Overdue</p>
              <p className="mt-1.5 text-3xl font-bold text-red-500">{overdueCount}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <AlertCircle className="text-red-500" size={20} />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Completed</p>
              <p className="mt-1.5 text-3xl font-bold text-green-600">{completedCount}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle2 className="text-green-600" size={20} />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total</p>
              <p className="mt-1.5 text-3xl font-bold">{totalCount}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
              <ClipboardList className="text-muted" size={20} />
            </div>
          </div>
        </article>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.value || (tab.value === "open" && !statusFilter);
          return (
            <Link
              key={tab.value}
              href={`/tasks?status=${tab.value}` as never}
              className={[
                "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "border border-border bg-panel text-muted hover:bg-background hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Main content — two columns */}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Task list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="text-primary" size={18} />
              <h2 className="font-semibold">Tasks</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {tasks.length}
              </span>
            </div>
          </CardHeader>

          {tasks.length === 0 ? (
            <CardBody>
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-background">
                  <ClipboardList className="text-muted" size={24} />
                </div>
                <p className="text-base font-semibold">No tasks match this filter.</p>
                <p className="mt-1 text-sm text-muted">
                  Create a task using the form on the right.
                </p>
              </div>
            </CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((task) => {
                const isComplete = task.completedAt !== null;
                const { label: dueDateLabel, overdue } = formatDueDate(task.dueDate);

                return (
                  <li
                    key={task.id}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-background/50 transition"
                  >
                    {/* Checkbox — toggle complete/uncomplete */}
                    <form
                      action={isComplete ? uncompleteTask : completeTask}
                      className="mt-0.5 shrink-0"
                    >
                      <input type="hidden" name="taskId" value={task.id} />
                      <button
                        type="submit"
                        className="text-muted hover:text-primary transition"
                        aria-label={isComplete ? "Mark as open" : "Mark as complete"}
                      >
                        {isComplete ? (
                          <CheckSquare size={18} className="text-green-600" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </form>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={[
                          "text-sm font-medium leading-snug",
                          isComplete ? "text-muted line-through" : "text-foreground",
                        ].join(" ")}
                      >
                        {task.title}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        {/* Contact link */}
                        <Link
                          href={`/contacts/${task.contact.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {task.contact.firstName} {task.contact.lastName ?? ""}
                        </Link>

                        {/* Due date */}
                        {dueDateLabel ? (
                          <span
                            className={[
                              "flex items-center gap-1",
                              overdue && !isComplete ? "text-red-500 font-semibold" : "",
                            ].join(" ")}
                          >
                            <Clock size={11} />
                            {dueDateLabel}
                          </span>
                        ) : null}

                        {/* Assignee */}
                        {task.assignedUser ? (
                          <span className="flex items-center gap-1">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {initials(task.assignedUser.name, task.assignedUser.email)}
                            </span>
                            {task.assignedUser.name ?? task.assignedUser.email}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted/60">
                            <User size={11} />
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <form action={deleteTask} className="shrink-0">
                      <input type="hidden" name="taskId" value={task.id} />
                      <button
                        type="submit"
                        className="mt-0.5 text-muted opacity-0 hover:text-red-500 group-hover:opacity-100 transition hover:opacity-100"
                        aria-label="Delete task"
                      >
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* New Task form */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">New Task</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createTask} className="space-y-4">
                <Field label="Title" name="title" placeholder="Follow up with client" required />

                {/* Contact select */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Contact <span className="text-red-400">*</span>
                  </span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    name="contactId"
                    required
                  >
                    <option value="">Select a contact…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName ?? ""}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Assignee select */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Assign To
                  </span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    name="assignedUserId"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.name ? `${m.user.name} (${m.user.email})` : m.user.email}
                      </option>
                    ))}
                  </select>
                </label>

                <Field label="Due Date" name="dueDate" type="date" />

                <SubmitButton
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  pendingText="Creating…"
                >
                  Create Task
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
