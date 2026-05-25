"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/ui/field";
import { inviteMember } from "./actions";

export function InviteForm({ agencyRole }: { agencyRole: string }) {
  const [result, setResult] = useState<{ ok?: boolean; inviteUrl?: string; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await inviteMember(formData);
      setResult(res);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {result?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</div>
      )}
      {result?.ok && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Invite sent!
          {result.inviteUrl && (
            <>
              {" "}
              <a
                className="underline"
                href={result.inviteUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Copy link
              </a>
            </>
          )}
        </div>
      )}

      <Field label="Email address" name="email" placeholder="colleague@agency.com" required type="email" />

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Role</span>
        <select
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
          defaultValue="MEMBER"
          name="role"
        >
          {agencyRole === "OWNER" && <option value="OWNER">Owner</option>}
          <option value="ADMIN">Admin</option>
          <option value="MEMBER">Member</option>
          <option value="READ_ONLY">Read only</option>
        </select>
      </label>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Sending invite…" : "Send invite"}
      </button>
    </form>
  );
}
