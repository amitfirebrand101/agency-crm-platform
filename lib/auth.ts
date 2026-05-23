import { redirect } from "next/navigation";
import type { AgencyRole, SubAccountRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const demoUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "owner@golowlevel.local",
  user_metadata: {
    full_name: "GoLowLevel Owner",
    name: "GoLowLevel Owner",
    avatar_url: null
  }
};

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  agencyId: string;
  agencyName: string;
  agencyRole: AgencyRole;
  subAccountId: string | null;
  subAccountName: string | null;
  subAccountRole: SubAccountRole | null;
};

export function isAuthDisabled() {
  return process.env.AUTH_DISABLED === "true";
}

export async function getAuthUser() {
  if (isAuthDisabled()) {
    return demoUser;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return null;
  }

  return user;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const authUser = await getAuthUser();

  if (!authUser?.email) {
    return null;
  }

  await prisma.user.upsert({
    where: { id: authUser.id },
    update: {
      email: authUser.email,
      name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
      imageUrl: authUser.user_metadata?.avatar_url ?? null
    },
    create: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
      imageUrl: authUser.user_metadata?.avatar_url ?? null
    }
  });

  const membership = await prisma.agencyMembership.findFirst({
    where: { userId: authUser.id },
    orderBy: { createdAt: "asc" },
    include: {
      agency: {
        include: {
          subAccounts: {
            orderBy: { createdAt: "asc" },
            take: 1,
            include: {
              members: {
                where: { userId: authUser.id },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  if (!membership) {
    const slugBase = authUser.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "agency";
    const agency = await prisma.agency.create({
      data: {
        name: "GoLowLevel Agency",
        slug: `${slugBase}-${authUser.id.slice(0, 8)}`,
        members: {
          create: {
            userId: authUser.id,
            role: "OWNER"
          }
        },
        subAccounts: {
          create: {
            name: "Primary Sub Account",
            slug: "primary",
            members: {
              create: {
                userId: authUser.id,
                role: "ADMIN"
              }
            }
          }
        }
      },
      include: {
        subAccounts: {
          include: {
            members: {
              where: { userId: authUser.id }
            }
          }
        }
      }
    });

    const subAccount = agency.subAccounts[0] ?? null;

    return {
      id: authUser.id,
      name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
      email: authUser.email,
      agencyId: agency.id,
      agencyName: agency.name,
      agencyRole: "OWNER",
      subAccountId: subAccount?.id ?? null,
      subAccountName: subAccount?.name ?? null,
      subAccountRole: subAccount?.members[0]?.role ?? null
    };
  }

  const subAccount = membership.agency.subAccounts[0] ?? null;
  const subAccountMembership = subAccount?.members[0] ?? null;

  return {
    id: authUser.id,
    name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
    email: authUser.email,
    agencyId: membership.agencyId,
    agencyName: membership.agency.name,
    agencyRole: membership.role,
    subAccountId: subAccount?.id ?? null,
    subAccountName: subAccount?.name ?? null,
    subAccountRole: subAccountMembership?.role ?? null
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export function canWriteAgency(role: AgencyRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canWriteSubAccount(role: SubAccountRole | null) {
  return role === "ADMIN" || role === "SALES" || role === "SUPPORT";
}
