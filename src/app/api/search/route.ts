import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canRead, MODULES } from "@/lib/rbac";
import { branchWhere } from "@/lib/branchScope";
import { ROLES } from "@/lib/constants";

export interface SearchHit {
  type: "student" | "lead" | "group" | "teacher";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

// Global qidiruv — natijalar rol huquqlariga qarab filtrlanadi.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ hits: [] }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ hits: [] });

  // Telefon bazada formatli saqlanadi ("+998 91 100 00 05"), shuning uchun
  // raqamli qidiruvda ikkala tomonni faqat raqamga tozalab solishtiramiz —
  // raqamning OXIRIDAN yoki o'rtasidan qidirsa ham topiladi.
  const qDigits = q.replace(/\D/g, "");
  const byDigits = qDigits.length >= 3;
  const digitsOf = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
  const phoneMatch = (phone: string | null | undefined) => byDigits && digitsOf(phone).includes(qDigits);

  const staff = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.ADMIN];
  const isStaff = staff.includes(session.role as never);
  const isTeacher = session.role === ROLES.TEACHER;
  const hits: SearchHit[] = [];
  const branch = branchWhere(session); // qidiruv ham faol filial doirasida

  // O'quvchilar (xodimlar va o'qituvchi ko'radi)
  if (isStaff || isTeacher) {
    const scope = isTeacher ? { enrollments: { some: { group: { teacherId: session.userId } } } } : {};
    const foundS = await prisma.student.findMany({
      where: { AND: [{ OR: [{ fullName: { contains: q } }, { phone: { contains: q } }], ...scope }, branch] },
      take: 5,
      select: { id: true, fullName: true, phone: true, currentLevel: true },
    });
    const extraS = byDigits
      ? (await prisma.student.findMany({
          where: { AND: [scope, branch] },
          orderBy: { createdAt: "desc" },
          take: 500,
          select: { id: true, fullName: true, phone: true, currentLevel: true },
        })).filter((x) => phoneMatch(x.phone))
      : [];
    const seenS = new Set<string>();
    const students = [...foundS, ...extraS].filter((x) => !seenS.has(x.id) && seenS.add(x.id)).slice(0, 5);
    for (const s of students) {
      hits.push({
        type: "student",
        id: s.id,
        title: s.fullName,
        subtitle: [s.currentLevel, s.phone].filter(Boolean).join(" · ") || null,
        href: "/students",
      });
    }
  }

  // Lidlar (CRM huquqi bo'lsa)
  if (canRead(session.role, MODULES.CRM)) {
    const found = await prisma.lead.findMany({
      where: { AND: [{ OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] }, branch] },
      take: 5,
      select: { id: true, fullName: true, phone: true, stage: true },
    });
    // Raqam bo'yicha qidiruv — formatli telefonlarni JSda tozalab solishtiramiz
    const extra = byDigits
      ? (await prisma.lead.findMany({
          where: branch,
          orderBy: { createdAt: "desc" },
          take: 500,
          select: { id: true, fullName: true, phone: true, stage: true },
        })).filter((l) => phoneMatch(l.phone))
      : [];
    const seen = new Set<string>();
    for (const l of [...found, ...extra]) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      if (seen.size > 5) break;
      // Lidni bosganda uning o'z sahifasi ochilsin (barcha ma'lumot bilan)
      hits.push({ type: "lead", id: l.id, title: l.fullName, subtitle: `${l.stage} · ${l.phone}`, href: `/crm/${l.id}` });
    }
  }

  // Guruhlar
  if (canRead(session.role, MODULES.GROUPS)) {
    const groups = await prisma.group.findMany({
      where: {
        AND: [
          { name: { contains: q }, ...(isTeacher ? { teacherId: session.userId } : {}) },
          branch,
        ],
      },
      take: 5,
      select: { id: true, name: true, levelCode: true, room: true },
    });
    for (const g of groups) {
      hits.push({
        type: "group",
        id: g.id,
        title: g.name,
        subtitle: [g.levelCode, g.room].filter(Boolean).join(" · ") || null,
        href: `/groups/${g.id}`,
      });
    }
  }

  // O'qituvchilar (faqat xodimlar)
  if (isStaff) {
    const foundT = await prisma.user.findMany({
      where: { AND: [{ role: ROLES.TEACHER, OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] }, branch] },
      take: 5,
      select: { id: true, fullName: true, phone: true },
    });
    const extraT = byDigits
      ? (await prisma.user.findMany({
          where: { AND: [{ role: ROLES.TEACHER }, branch] },
          take: 500,
          select: { id: true, fullName: true, phone: true },
        })).filter((x) => phoneMatch(x.phone))
      : [];
    const seenT = new Set<string>();
    const teachers = [...foundT, ...extraT].filter((x) => !seenT.has(x.id) && seenT.add(x.id)).slice(0, 5);
    for (const t of teachers) {
      hits.push({ type: "teacher", id: t.id, title: t.fullName, subtitle: t.phone, href: "/teachers" });
    }
  }

  return NextResponse.json({ hits: hits.slice(0, 15) });
}
