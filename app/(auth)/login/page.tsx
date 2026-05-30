import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getPublicEnv } from "@/lib/env";

export default function LoginPage() {
  const env = getPublicEnv();

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-sm font-semibold text-primary">{env.appName}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to your agency command center</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Secure access for agency teams, sub accounts, client data, and CRM operations.
            </p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
      <section className="hidden border-l border-border bg-foreground p-10 text-white lg:block">
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="text-sm font-semibold text-white/70">Secure multi-tenant CRM</div>
            <div className="mt-10 max-w-2xl text-5xl font-semibold leading-tight">
              Manage contacts, conversations, opportunities, calendars, sites, and campaigns from one focused workspace.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm text-white/75">
            <div className="rounded-lg border border-white/10 p-4">Tenant scoped access</div>
            <div className="rounded-lg border border-white/10 p-4">Role-aware operations</div>
            <div className="rounded-lg border border-white/10 p-4">Audit-ready records</div>
          </div>
        </div>
      </section>
    </main>
  );
}
