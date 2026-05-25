"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { auditLog } from "@/lib/security";

export async function signOut() {
  // Capture user info before invalidating the session
  const user = await getCurrentUser();

  const supabase = await createClient();
  await supabase.auth.signOut();

  // Record the logout event (best-effort — session already gone so non-fatal)
  if (user) {
    await auditLog({
      agencyId:    user.agencyId,
      actorUserId: user.id,
      action:      "LOGOUT",
      entityType:  "Session",
    }).catch(() => {});
  }

  redirect("/login");
}
