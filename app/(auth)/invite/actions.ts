"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { auditLog } from "@/lib/security";
import { logger } from "@/lib/logger";

/**
 * Accept an invite by token.
 * The accepting user must already be authenticated (sign up / log in first).
 * The token is validated, membership created, and the invite marked accepted.
 */
export async function acceptInvite(token: string): Promise<{ error?: string }> {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect(`/login?next=/invite/accept?token=${encodeURIComponent(token)}`);
  }

  const now = new Date();

  const invite = await prisma.userInvite.findUnique({ where: { token } });

  if (!invite) {
    return { error: "Invite not found or already accepted." };
  }
  if (invite.revokedAt) {
    return { error: "This invite has been revoked." };
  }
  if (invite.acceptedAt) {
    return { error: "This invite has already been accepted." };
  }
  if (invite.expiresAt < now) {
    return { error: "This invite has expired. Ask the agency owner to send a new one." };
  }
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return { error: `This invite was sent to ${invite.email}. Please sign in with that email address.` };
  }

  // Check if user already has a membership in this agency
  const existing = await prisma.agencyMembership.findUnique({
    where: { agencyId_userId: { agencyId: invite.agencyId, userId: user.id } },
  });

  if (existing) {
    // Mark invite accepted anyway and redirect
    await prisma.userInvite.update({
      where: { token },
      data: { acceptedAt: now },
    });
    redirect("/dashboard");
  }

  // Create the agency membership and mark invite accepted in a transaction
  try {
    await prisma.$transaction([
      prisma.agencyMembership.create({
        data: {
          agencyId:    invite.agencyId,
          userId:      user.id,
          role:        invite.role,
          invitedById: invite.invitedById ?? undefined,
        },
      }),
      prisma.userInvite.update({
        where: { token },
        data: { acceptedAt: now },
      }),
    ]);

    await auditLog({
      agencyId:    invite.agencyId,
      actorUserId: user.id,
      action:      "INVITE_ACCEPTED",
      entityType:  "AgencyMembership",
      metadata:    { role: invite.role, invitedById: invite.invitedById },
    });

    logger.info("Invite accepted", {
      agencyId: invite.agencyId,
      userId:   user.id,
      role:     invite.role,
    });
  } catch (err) {
    logger.error("Failed to accept invite", { error: String(err) });
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/dashboard");
}
