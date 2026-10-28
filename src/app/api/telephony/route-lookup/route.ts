import { prisma } from "@/lib/db";
import { last9, leadIdsByPhone } from "@/lib/phoneLookup";

const text = (s: string) => new Response(s, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const digits = last9(new URL(req.url).searchParams.get("phone") ?? "");
  if (!digits) return text("");

  const ids = await leadIdsByPhone(digits, 5);
  if (!ids.length) return text("");
  const lead = await prisma.lead.findFirst({
    where: { id: { in: ids }, managerId: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { manager: { select: { sipExtension: true, isActive: true } } },
  });
  const ext = lead?.manager?.isActive ? lead.manager.sipExtension : null;
  return text(ext || "");
}
