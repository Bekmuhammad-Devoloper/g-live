import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { branchWhere } from "@/lib/branchScope";
import { ROLES } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

// Konversiya hisoboti — alohida API.
// UI (/reports/conversion) sana / manba / xodim filtrlarini shu yerga yuboradi,
// natijada voronka sanog'i + tanlangan bosqich lidlari qaytadi.

// Sahifadagi ALLOWED bilan bir xil — administrator kiritilmagan
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ROP, ROLES.MANAGER];

// Bizning LEAD_STAGES → 5 ta Modme voronka bosqichiga moslashtirilgan
const BUCKETS: { key: string; stages: string[] }[] = [
  { key: "kutish", stages: ["NEW", "IN_PROGRESS"] },
  { key: "toplam", stages: ["CONTACTED", "TEST", "OFFER"] },
  { key: "davomat", stages: ["AWAITING_PAYMENT"] },
  { key: "tolangan", stages: ["PAID", "WON"] },
];

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(session.role as never)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const source = url.searchParams.get("source") || "";
  const manager = url.searchParams.get("manager") || "";

  // Sana oralig'i (kun) → DateTime filtri
  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = new Date(`${from}T00:00:00`);
  if (to) createdAt.lte = new Date(`${to}T23:59:59`);

  // Barcha so'rovlar faol filial doirasida (filialsiz eski lidlar ham)
  const branch = branchWhere(session);
  const where: Prisma.LeadWhereInput = {
    AND: [
      {
        ...(from || to ? { createdAt } : {}),
        ...(source ? { source } : {}),
        ...(manager ? { managerId: manager } : {}),
      },
      branch,
    ],
  };

  // Sana/manba filtrisiz — dropdown variantlari va xodim nomlari uchun
  const allLeads = await prisma.lead.findMany({ where: branch, select: { source: true, managerId: true } });
  const allManagerIds = Array.from(new Set(allLeads.map((l) => l.managerId).filter((x): x is string => !!x)));
  const users = allManagerIds.length
    ? await prisma.user.findMany({ where: { id: { in: allManagerIds } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  const sources = Array.from(new Set(allLeads.map((l) => l.source).filter((x): x is string => !!x))).sort();
  const managers = users.map((u) => ({ id: u.id, name: u.fullName })).sort((a, b) => a.name.localeCompare(b.name));

  // Filtrlangan lidlar
  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, fullName: true, phone: true, stage: true, managerId: true },
  });

  const counts: Record<string, number> = { sorovlar: leads.length };
  for (const b of BUCKETS) counts[b.key] = leads.filter((l) => b.stages.includes(l.stage)).length;

  const rows = leads.map((l) => ({
    id: l.id,
    fullName: l.fullName,
    phone: l.phone,
    stage: l.stage,
    managerName: l.managerId ? nameById.get(l.managerId) ?? null : null,
  }));

  return NextResponse.json({
    total: leads.length,
    counts,
    leads: rows,
    options: { sources, managers },
  });
}
