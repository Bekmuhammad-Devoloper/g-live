import { requireSession } from "@/lib/auth";
import { branchViaStudent, branchWhere } from "@/lib/branchScope";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import ChatView, { type VMsg, type VThread } from "./ChatView";

// "O'quvchilar yozishmasi" — o'quvchi /student/lehrer dan yozadi, ustoz
// shu yerdan javob beradi. Ustoz faqat o'z guruhlari o'quvchilarini ko'radi.

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.CHAT)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(s.locale, {
          uz: "Bu bo'lim uchun ruxsatingiz yo'q.",
          ru: "У вас нет доступа к этому разделу.",
          en: "You do not have permission for this section.",
          de: "Sie haben keine Berechtigung für diesen Bereich.",
        })}
      />
    );
  }

  const { s: active = null } = await searchParams;

  // Ustoz — faqat o'z guruhlaridagi o'quvchilar bilan
  const scope =
    s.role === ROLES.TEACHER
      ? { student: { enrollments: { some: { isActive: true, group: { teacherId: s.userId } } } } }
      : branchViaStudent(s);

  // Ilovaga ulangan o'quvchilar — ustoz yozishmani o'zi boshlashi uchun
  // ular ham ro'yxatda turadi (hali xabar yozmagan bo'lsa ham).
  const studentScope =
    s.role === ROLES.TEACHER
      ? { userId: { not: null }, enrollments: { some: { isActive: true, group: { teacherId: s.userId } } } }
      : { userId: { not: null }, ...branchWhere(s) };

  const [linked, rows] = await Promise.all([
    prisma.student.findMany({
      where: studentScope,
      orderBy: { fullName: "asc" },
      take: 500,
      select: {
        id: true,
        fullName: true,
        enrollments: {
          where: { isActive: true },
          take: 1,
          orderBy: { joinedAt: "desc" },
          select: { group: { select: { name: true } } },
        },
      },
    }),
    prisma.chatMessage.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    take: 800,
    select: {
      id: true,
      studentId: true,
      fromStudent: true,
      text: true,
      createdAt: true,
      readAt: true,
      author: { select: { fullName: true } },
      student: {
        select: {
          fullName: true,
          enrollments: {
            where: { isActive: true },
            take: 1,
            orderBy: { joinedAt: "desc" },
            select: { group: { select: { name: true } } },
          },
        },
      },
      },
    }),
  ]);

  // Suhbatlar ro'yxati — oxirgi xabar bo'yicha
  const byStudent = new Map<string, VThread>();
  for (const m of rows) {
    const cur = byStudent.get(m.studentId);
    if (!cur) {
      byStudent.set(m.studentId, {
        studentId: m.studentId,
        student: m.student.fullName,
        group: m.student.enrollments[0]?.group.name ?? null,
        last: m.text,
        lastAt: m.createdAt.toISOString(),
        unread: m.fromStudent && !m.readAt ? 1 : 0,
      });
    } else if (m.fromStudent && !m.readAt) {
      cur.unread++;
    }
  }
  // Xabar yozmagan o'quvchilar ham ro'yxatda — bo'sh suhbat sifatida
  for (const st of linked) {
    if (byStudent.has(st.id)) continue;
    byStudent.set(st.id, {
      studentId: st.id,
      student: st.fullName,
      group: st.enrollments[0]?.group.name ?? null,
      last: "",
      lastAt: "",
      unread: 0,
    });
  }

  // Avval o'qilmaganlar, keyin so'nggi xabar, oxirida yozishmasi yo'qlar
  const threads = [...byStudent.values()].sort((a, b) => {
    if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) return (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0);
    if (a.lastAt !== b.lastAt) return b.lastAt.localeCompare(a.lastAt);
    return a.student.localeCompare(b.student, "uz");
  });

  const messages: VMsg[] = active
    ? rows
        .filter((m) => m.studentId === active)
        .reverse()
        .map((m) => ({
          id: m.id,
          fromStudent: m.fromStudent,
          text: m.text,
          at: m.createdAt.toISOString(),
          author: m.fromStudent ? null : (m.author?.fullName ?? null),
        }))
    : [];

  const unreadTotal = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          O&apos;quvchilar yozishmasi
          {unreadTotal > 0 ? (
            <span className="ml-2 rounded-full bg-cyan-600 px-2 py-[2px] align-middle text-xs font-bold text-white">
              {unreadTotal}
            </span>
          ) : null}
        </h1>
        <p className="text-sm text-slate-500">
          O&apos;quvchi ilovadagi &laquo;Ustozga yozish&raquo; bo&apos;limidan yozadi — javobingiz o&apos;sha yerda chiqadi.
        </p>
      </div>
      <ChatView threads={threads} active={active} messages={messages} canWrite={canWrite(s.role, MODULES.CHAT)} />
    </div>
  );
}
