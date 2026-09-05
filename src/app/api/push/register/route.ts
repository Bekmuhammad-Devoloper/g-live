import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Android ilovasi Firebase'dan olgan push manzilini shu yerga yuboradi.
//
// Manzil (token) qurilmaga emas, ILOVA O'RNATMASIGA tegishli va Firebase
// uni vaqti-vaqti bilan yangilab turadi. Shu sabab:
//   · token bo'yicha upsert qilamiz (dublikat yig'ilmasin)
//   · token boshqa hisobda ro'yxatdan o'tgan bo'lsa, EGASI almashtiriladi.
//     Bu muhim: bitta telefondan aka-uka navbat bilan kirsa, bildirishnoma
//     oxirgi kirgan odamga ketishi kerak, oldingisiga emas.

const Body = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["android", "ios"]).default("android"),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { token, platform } = parsed.data;

  await prisma.pushDevice.upsert({
    where: { token },
    create: { token, platform, userId: s.userId },
    update: { userId: s.userId, platform, lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

// Chiqishda qurilmani ro'yxatdan olib tashlash: shundan keyin bu telefonga
// o'sha hisobning bildirishnomalari kelmaydi.
export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const parsed = Body.pick({ token: true }).safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // Faqat O'ZINING qurilmasini o'chira oladi
  await prisma.pushDevice.deleteMany({
    where: { token: parsed.data.token, userId: s.userId },
  });

  return NextResponse.json({ ok: true });
}
