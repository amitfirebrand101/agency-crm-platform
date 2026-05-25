"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { generateToken } from "@/lib/crypto";
import { agencySchema } from "@/lib/validation";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Agency profile
// ─────────────────────────────────────────────────────────────────────────────

export async function updateAgency(formData: FormData) {
  const user = await requireUser();
  assertCan(user.agencyRole, user.subAccountRole, "settings", "write");

  const input = agencySchema.parse(Object.fromEntries(formData));

  await prisma.agency.update({
    where: { id: user.agencyId },
    data: {
      name:     input.name,
      timezone: input.timezone  || undefined,
      currency: input.currency?.toUpperCase() || undefined,
      country:  input.country?.toUpperCase()  || undefined,
    },
  });

  await auditLog({
    agencyId:    user.agencyId,
    actorUserId: user.id,
    action:      "UPDATE",
    entityType:  "Agency",
    entityId:    user.agencyId,
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────────────────────────────────────
// Invite a new team member
// ─────────────────────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role:  z.enum(["OWNER", "ADMIN", "MEMBER", "READ_ONLY"]),
});

export async function inviteMember(
  formData: FormData
): Promise<{ ok: boolean; inviteUrl?: string; error?: string }> {
  const user = await requireUser();
  assertCan(user.agencyRole, user.subAccountRole, "team", "invite");

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (parsed.data.role === "OWNER" && user.agencyRole !== "OWNER") {
    return { ok: false, error: "Only the agency owner can invite another owner." };
  }

  // Revoke existing pending invites for same email in this agency
  await prisma.userInvite.updateMany({
    where: {
      agencyId:   user.agencyId,
      email:      parsed.data.email.toLowerCase(),
      acceptedAt: null,
      revokedAt:  null,
    },
    data: { revokedAt: new Date() },
  });

  const token     = generateToken(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.userInvite.create({
    data: {
      agencyId:    user.agencyId,
      email:       parsed.data.email.toLowerCase(),
      role:        parsed.data.role,
      token,
      expiresAt,
      invitedById: user.id,
    },
  });

  await auditLog({
    agencyId:    user.agencyId,
    actorUserId: user.id,
    action:      "INVITE",
    entityType:  "UserInvite",
    metadata:    { email: parsed.data.email, role: parsed.data.role },
  });

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite?token=${token}`;

  // Send email if SMTP is configured
  try {
    const { emailConfigured, sendEmail } = await import("@/lib/email");
    if (emailConfigured()) {
      const agency = await prisma.agency.findUnique({
        where: { id: user.agencyId },
        select: { name: true },
      });
      await sendEmail({
        to:      parsed.data.email,
        subject: `You're invited to join ${agency?.name ?? "an agency"}`,
        html: `
          <p>Hi,</p>
          <p>You've been invited to join <strong>${agency?.name}</strong> as
             <strong>${parsed.data.role}</strong>.</p>
          <p style="margin:24px 0">
            <a href="${inviteUrl}"
               style="background:#0e7490;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
              Accept Invite
            </a>
          </p>
          <p style="color:#666;font-size:12px;">
            This invite expires in 7 days. If you weren't expecting this, ignore this email.
          </p>
        `,
      });
    }
  } catch {
    // Non-fatal — inviteUrl is returned regardless
  }

  revalidatePath("/settings");
  return { ok: true, inviteUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// Revoke a pending invite
// ─────────────────────────────────────────────────────────────────────────────

export async function revokeInvite(inviteId: string): Promise<void> {
  const user = await requireUser();
  assertCan(user.agencyRole, user.subAccountRole, "team", "invite");

  const invite = await prisma.userInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.agencyId !== user.agencyId) return;

  await prisma.userInvite.update({
    where: { id: inviteId },
    data:  { revokedAt: new Date() },
  });

  revalidatePath("/settings");
}

// ─────────────────────────────────────────────────────────────────────────────
// Deactivate / reactivate a member
// ─────────────────────────────────────────────────────────────────────────────

export async function deactivateMember(membershipId: string): Promise<void> {
  const user = await requireUser();
  assertCan(user.agencyRole, user.subAccountRole, "team", "deactivate");

  const membership = await prisma.agencyMembership.findUnique({
    where: { id: membershipId },
  });
  if (!membership || membership.agencyId !== user.agencyId) return;

  if (membership.userId === user.id) {
    throw new Error("You cannot deactivate your own account.");
  }
  if (membership.role === "OWNER" && user.agencyRole !== "OWNER") {
    throw new Error("Only the agency owner can deactivate another owner.");
  }

  await prisma.agencyMembership.update({
    where: { id: membershipId },
    data:  { deactivatedAt: new Date() },
  });

  await auditLog({
    agencyId:    user.agencyId,
    actorUserId: user.id,
    action:      "DEACTIVATE",
    entityType:  "AgencyMembership",
    entityId:    membershipId,
  });

  revalidatePath("/settings");
}

export async function reactivateMember(membershipId: string): Promise<void> {
  const user = await requireUser();
  assertCan(user.agencyRole, user.subAccountRole, "team", "deactivate");

  const membership = await prisma.agencyMembership.findUnique({
    where: { id: membershipId },
  });
  if (!membership || membership.agencyId !== user.agencyId) return;

  await prisma.agencyMembership.update({
    where: { id: membershipId },
    data:  { deactivatedAt: null },
  });

  await auditLog({
    agencyId:    user.agencyId,
    actorUserId: user.id,
    action:      "REACTIVATE",
    entityType:  "AgencyMembership",
    entityId:    membershipId,
  });

  revalidatePath("/settings");
}

// ─────────────────────────────────────────────────────────────────────────────
// Change a member's role
// ─────────────────────────────────────────────────────────────────────────────

export async function changeMemberRole(
  membershipId: string,
  newRole: "OWNER" | "ADMIN" | "MEMBER" | "READ_ONLY"
): Promise<void> {
  const user = await requireUser();
  if (user.agencyRole !== "OWNER") {
    throw new Error("Only the agency owner can change member roles.");
  }

  const membership = await prisma.agencyMembership.findUnique({
    where: { id: membershipId },
  });
  if (!membership || membership.agencyId !== user.agencyId) return;
  if (membership.userId === user.id) throw new Error("Cannot change your own role.");

  await prisma.agencyMembership.update({
    where: { id: membershipId },
    data:  { role: newRole },
  });

  await auditLog({
    agencyId:    user.agencyId,
    actorUserId: user.id,
    action:      "UPDATE",
    entityType:  "AgencyMembership",
    entityId:    membershipId,
    metadata:    { newRole },
  });

  revalidatePath("/settings");
}
