import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Softphone chiquvchi qo'ng'iroq paytida shu yerni so'rab turadi:
// mijoz ko'targanmi? (answeredAt to'lgan bo'lsa — taymer boshlanadi)
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "no_id" }, { status: 400 });

  const c = await prisma.call.findUnique({
    where: { id },
    select: { operatorId: true, status: true, answeredAt: true, endedAt: true, duration: true },
  });
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (c.operatorId && c.operatorId !== s.userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json(
    {
      status: c.status,
      answered: Boolean(c.answeredAt),
      ended: Boolean(c.endedAt),
      duration: c.duration,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
