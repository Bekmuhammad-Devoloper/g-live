import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canRead, MODULES } from "@/lib/rbac";
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

  const staff = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.ADMIN];
  const isStaff = staff.includes(session.role as never);
  const isTeacher = session.role === ROLES.TEACHER;
  const hits: SearchHit[] = [];

  // O'quvchilar (xodimlar va o'qituvchi ko'radi)
  if (isStaff || isTeacher) {
    const students = await prisma.student.findMany({
      where: {
        OR: [{ fullName: { contains: q } }, { phone: { contains: q } }],
        ...(isTeacher ? { enrollments: { some: { group: { teacherId: session.userId } } } } : {}),
      },
      take: 5,
      select: { id: true, fullName: true, phone: true, currentLevel: true },
    });
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
    const leads = await prisma.lead.findMany({
      where: { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] },
      take: 5,
      select: { id: true, fullName: true, phone: true, stage: true },
    });
    for (const l of leads) {
      hits.push({ type: "lead", id: l.id, title: l.fullName, subtitle: `${l.stage} · ${l.phone}`, href: "/crm" });
    }
  }

  // Guruhlar
  if (canRead(session.role, MODULES.GROUPS)) {
    const groups = await prisma.group.findMany({
      where: {
        name: { contains: q },
        ...(isTeacher ? { teacherId: session.userId } : {}),
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
    const teachers = await prisma.user.findMany({
      where: { role: ROLES.TEACHER, OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] },
      take: 5,
      select: { id: true, fullName: true, phone: true },
    });
    for (const t of teachers) {
      hits.push({ type: "teacher", id: t.id, title: t.fullName, subtitle: t.phone, href: "/teachers" });
    }
  }

  return NextResponse.json({ hits: hits.slice(0, 15) });
}
