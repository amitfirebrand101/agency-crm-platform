"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPublicEnv } from "@/lib/env";

export default function ForgotPasswordPage() {
  const env = getPublicEnv();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const email = String(formData.get("email") ?? "").trim();

      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        // Supabase appends ?code=xxx&type=recovery to this URL
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setDone(true);
    });
  }

  if (done) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 text-4xl">📬</div>
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="mt-3 text-sm text-muted">
            If that email is registered, you&apos;ll receive a password reset link shortly.
            The link expires in 1 hour.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">{env.appName}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Enter your account email and we&apos;ll send you a link to set a new password.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Email</span>
            <input
              autoComplete="email"
              className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              name="email"
              placeholder="you@agency.com"
              required
              type="email"
            />
          </label>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? <Loader2 className="animate-spin" size={16} /> : null}
            Send reset link
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
