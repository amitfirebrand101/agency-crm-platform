"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Square,
  Trash2,
  ClipboardList,
  Clock,
  User,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { completeTask, uncompleteTask, deleteTask } from "./actions";

type TaskRow = {
  id: string;
  title: string;
  dueDate: Date | null;
  completedAt: Date | null;
  contact: { id: string; firstName: string; lastName: string | null };
  assignedUser: { id: string; name: string | null; email: string } | null;
};

type OptAction =
  | { type: "complete"; id: string }
  | { type: "uncomplete"; id: string }
  | { type: "delete"; id: string };

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

export function TaskList({ tasks: initialTasks }: { tasks: TaskRow[] }) {
  const [, startTransition] = useTransition();

  const [tasks, applyOptimistic] = useOptimistic<TaskRow[], OptAction>(
    initialTasks,
    (state, action) => {
      if (action.type === "delete") return state.filter((t) => t.id !== action.id);
      return state.map((t) => {
        if (t.id !== action.id) return t;
        if (action.type === "complete") return { ...t, completedAt: new Date() };
        return { ...t, completedAt: null };
      });
    }
  );

  function toggleComplete(taskId: string, isComplete: boolean) {
    const fd = new FormData();
    fd.set("taskId", taskId);
    startTransition(async () => {
      applyOptimistic({ type: isComplete ? "uncomplete" : "complete", id: taskId });
      if (isComplete) {
        await uncompleteTask(fd);
      } else {
        await completeTask(fd);
      }
    });
  }

  function handleDelete(taskId: string) {
    const fd = new FormData();
    fd.set("taskId", taskId);
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: taskId });
      await deleteTask(fd);
    });
  }

  return (
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
                className="group flex items-start gap-3 px-5 py-3.5 hover:bg-background/50 transition"
              >
                <button
                  type="button"
                  onClick={() => toggleComplete(task.id, isComplete)}
                  className="mt-0.5 shrink-0 text-muted hover:text-primary transition"
                  aria-label={isComplete ? "Mark as open" : "Mark as complete"}
                >
                  {isComplete ? (
                    <CheckSquare size={18} className="text-green-600" />
                  ) : (
                    <Square size={18} />
                  )}
                </button>

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
                    <Link
                      href={`/contacts/${task.contact.id}` as never}
                      className="font-medium text-primary hover:underline"
                    >
                      {task.contact.firstName} {task.contact.lastName ?? ""}
                    </Link>

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

                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  className="mt-0.5 shrink-0 text-muted opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
                  aria-label="Delete task"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
