"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPublicEnv } from "@/lib/env";

export default function ResetPasswordPage() {
  const env = getPublicEnv();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const password = String(formData.get("password") ?? "");
      const confirm  = String(formData.get("confirm") ?? "");

      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }

      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Password updated — sign them in and redirect
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">{env.appName}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Set a new password</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Choose a strong password of at least 8 characters.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">New password</span>
            <input
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              minLength={8}
              name="password"
              placeholder="At least 8 characters"
              required
              type="password"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Confirm password</span>
            <input
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              minLength={8}
              name="confirm"
              placeholder="Repeat your new password"
              required
              type="password"
            />
          </label>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? <Loader2 className="animate-spin" size={16} /> : null}
            Update password
          </button>
        </form>
      </div>
    </main>
  );
}
