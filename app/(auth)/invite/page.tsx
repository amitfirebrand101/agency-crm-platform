import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { acceptInvite } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  OWNER:     "Owner",
  ADMIN:     "Admin",
  MEMBER:    "Member",
  READ_ONLY: "Read-only",
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token?.trim();

  if (!token) redirect("/login");

  const invite = await prisma.userInvite.findUnique({
    where: { token },
    include: { agency: { select: { name: true } } },
  });

  const now = new Date();
  const isExpired  = invite && invite.expiresAt < now;
  const isRevoked  = invite && !!invite.revokedAt;
  const isAccepted = invite && !!invite.acceptedAt;
  const isValid    = !!(invite && !isExpired && !isRevoked && !isAccepted);

  // Current session (if any)
  const user = await getCurrentUser();

  // ─── Invalid / expired invite ───────────────────────────────────────────────
  if (!isValid) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <XCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h1 className="text-2xl font-semibold">
            {!invite     ? "Invite not found"   :
             isRevoked   ? "Invite revoked"     :
             isExpired   ? "Invite expired"     :
                           "Already accepted"}
          </h1>
          <p className="mt-3 text-sm text-muted">
            {!invite     ? "This invite link is invalid or has already been used." :
             isRevoked   ? "This invite was revoked by the agency admin."          :
             isExpired   ? "This invite link has expired. Ask the agency to send a new one." :
                           "This invite has already been accepted."}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-white"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  // ─── Valid invite ────────────────────────────────────────────────────────────
  const wrongUser = user && user.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-panel p-8 shadow-soft text-center">
          <CheckCircle2 className="mx-auto mb-4 text-primary" size={48} />
          <h1 className="text-2xl font-semibold">You&apos;re invited</h1>
          <p className="mt-3 text-sm text-muted">
            You&apos;ve been invited to join{" "}
            <strong className="text-foreground">{invite.agency.name}</strong> as{" "}
            <strong className="text-foreground">{ROLE_LABELS[invite.role] ?? invite.role}</strong>.
          </p>
          <p className="mt-1 text-xs text-muted">Invite sent to {invite.email}</p>

          {wrongUser ? (
            <div className="mt-6 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              You&apos;re currently signed in as <strong>{user.email}</strong>. This invite
              was sent to <strong>{invite.email}</strong>. Please sign out and sign in with
              the correct account, or create one.
            </div>
          ) : null}

          {!user ? (
            <div className="mt-6 space-y-3">
              <Link
                href={`/signup?email=${encodeURIComponent(invite.email)}&next=/invite?token=${encodeURIComponent(token)}`}
                className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Create account &amp; accept
              </Link>
              <Link
                href={`/login?next=/invite?token=${encodeURIComponent(token)}`}
                className="flex w-full items-center justify-center rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-background transition"
              >
                Sign in &amp; accept
              </Link>
            </div>
          ) : !wrongUser ? (
            <form
              action={async () => {
                "use server";
                await acceptInvite(token);
              }}
              className="mt-6"
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Accept invite
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
