import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function escapeCsv(val: unknown): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(fields: unknown[]) {
  return fields.map(escapeCsv).join(",") + "\n";
}

export async function GET(req: NextRequest) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Accept optional ?ids=uuid,uuid,... to export selected contacts only
  const idsParam = req.nextUrl.searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").filter((id) => /^[0-9a-f-]{36}$/.test(id)) : [];

  const contacts = await prisma.contact.findMany({
    where: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined,
      ...(ids.length > 0 ? { id: { in: ids } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
    include: {
      tags: { include: { tag: { select: { name: true } } } },
      customValues: { include: { customField: { select: { key: true, name: true } } } },
    },
  });

  // Build CSV
  const headers = [
    "ID","First Name","Last Name","Email","Phone","Company","Status",
    "Source","Address","City","Region","Country","Postal Code",
    "Email Opt Out","SMS Opt Out","Tags","Created At",
  ];

  let csv = row(headers);
  for (const c of contacts) {
    csv += row([
      c.id,
      c.firstName,
      c.lastName ?? "",
      c.email ?? "",
      c.phone ?? "",
      c.companyName ?? "",
      c.status,
      c.source ?? "",
      c.addressLine1 ?? "",
      c.city ?? "",
      c.region ?? "",
      c.country ?? "",
      c.postalCode ?? "",
      c.emailOptOut ? "Yes" : "No",
      c.smsOptOut ? "Yes" : "No",
      c.tags.map((t) => t.tag.name).join("; "),
      c.createdAt.toISOString(),
    ]);
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
