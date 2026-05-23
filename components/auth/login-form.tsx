"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Chrome, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestedNext = searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";

  function signInWithPassword(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace(next as Route);
      router.refresh();
    });
  }

  function signInWithGoogle() {
    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        }
      });

      if (signInError) {
        setError(signInError.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-panel px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-background"
        disabled={isPending}
        onClick={signInWithGoogle}
        type="button"
      >
        <Chrome size={17} />
        Continue with Google
      </button>
      <div className="relative py-2 text-center text-xs text-muted">
        <span className="bg-background px-2">or use email</span>
        <div className="absolute left-0 right-0 top-1/2 -z-10 border-t border-border" />
      </div>
      <form action={signInWithPassword} className="space-y-4">
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
            autoComplete="current-password"
            className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
            minLength={8}
            name="password"
            placeholder="Password"
            required
            type="password"
          />
        </label>
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <button
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? <Loader2 className="animate-spin" size={16} /> : null}
          Sign in
        </button>
      </form>
    </div>
  );
}
