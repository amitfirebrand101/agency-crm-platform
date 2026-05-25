import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, canWriteSubAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_CONTACTS = 10_000;

const contactRowSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")).transform((v) => v || undefined),
  phone: z.string().trim().max(32).optional(),
  companyName: z.string().trim().max(120).optional(),
  status: z.enum(["LEAD","CUSTOMER","INACTIVE"]).optional().default("LEAD"),
  source: z.string().trim().max(100).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
});

export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  let body: { contacts: unknown[]; tagOnImport?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const rawContacts = Array.isArray(body.contacts) ? body.contacts.slice(0, MAX_CONTACTS) : [];
  const tagName = typeof body.tagOnImport === "string" ? body.tagOnImport.trim() : "";

  // Resolve or create tag
  let tagId: string | null = null;
  if (tagName) {
    try {
      const tag = await prisma.tag.upsert({
        where: { agencyId_subAccountId_name: { agencyId: user.agencyId, subAccountId: user.subAccountId, name: tagName } },
        update: {},
        create: { agencyId: user.agencyId, subAccountId: user.subAccountId, name: tagName },
      });
      tagId = tag.id;
    } catch { /* non-fatal */ }
  }

  // Load existing emails for deduplication
  const existingEmails = new Set(
    (await prisma.contact.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId, email: { not: null } },
      select: { email: true },
    })).map((c) => c.email?.toLowerCase())
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Process in batches of 100
  const BATCH = 100;
  for (let i = 0; i < rawContacts.length; i += BATCH) {
    const batch = rawContacts.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (raw, idx) => {
        const rowNum = i + idx + 1;
        const parsed = contactRowSchema.safeParse(raw);
        if (!parsed.success) {
          errors.push(`Row ${rowNum}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
          return;
        }
        const d = parsed.data;

        // Skip by email if already exists
        if (d.email && existingEmails.has(d.email.toLowerCase())) {
          skipped++;
          return;
        }
        if (d.email) existingEmails.add(d.email.toLowerCase());

        try {
          const contact = await prisma.contact.create({
            data: {
              agencyId: user.agencyId,
              subAccountId: user.subAccountId!,
              firstName: d.firstName,
              lastName: d.lastName ?? null,
              email: d.email ?? null,
              phone: d.phone ?? null,
              companyName: d.companyName ?? null,
              status: d.status,
              source: d.source ?? null,
              addressLine1: d.addressLine1 ?? null,
              city: d.city ?? null,
              region: d.region ?? null,
              country: d.country ?? null,
              postalCode: d.postalCode ?? null,
            },
          });

          if (tagId) {
            await prisma.contactTag.create({ data: { contactId: contact.id, tagId } }).catch(() => {});
          }
          imported++;
        } catch (err) {
          errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : "failed"}`);
        }
      })
    );
  }

  return NextResponse.json({ imported, skipped, errors });
}
