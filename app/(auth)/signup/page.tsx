"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPublicEnv } from "@/lib/env";

export default function SignupPage() {
  const env = getPublicEnv();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);

      const email    = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      const confirm  = String(formData.get("confirm") ?? "");

      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }

      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Supabase sends a confirmation email; redirect back into the app
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
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
            We sent a confirmation link to your email address. Click it to activate
            your account and sign in.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-sm font-semibold text-primary">{env.appName}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create your account</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Your agency workspace is provisioned automatically on first login.
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
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Password</span>
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
                placeholder="Repeat your password"
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
              Create account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link className="font-semibold text-primary hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </section>
      <section className="hidden border-l border-border bg-foreground p-10 text-white lg:block">
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="text-sm font-semibold text-white/70">Secure multi-tenant CRM</div>
            <div className="mt-10 max-w-2xl text-5xl font-semibold leading-tight">
              Get started in seconds. Your full agency workspace is ready on first login.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm text-white/75">
            <div className="rounded-lg border border-white/10 p-4">Contacts & Pipelines</div>
            <div className="rounded-lg border border-white/10 p-4">Conversations & SMS</div>
            <div className="rounded-lg border border-white/10 p-4">Automations & Calendars</div>
          </div>
        </div>
      </section>
    </main>
  );
}
