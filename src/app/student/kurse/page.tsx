import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  CARD, TEAL, NAVY, SOFT_GRADIENT, fmtDate, safeUrl,
  PageHeader, Ring, SectionTitle, IconBadge,
  IcoBook, IcoCheck, IcoLock, IcoPlay, IcoDoc, IcoCalendar, IcoClock, IcoTeacher, IcoPin, IcoDownload,
} from "../_ui";
import MissingStudent from "../MissingStudent";

// "Kurse" — o'quvchining kurs sahifasi (Start ekrani uslubida).
// Kurs yo'li: o'tilgan darslar (✓), joriy dars (ochiq karta), kelgusilar (qulf).
// Ma'lumot manbai: CourseLesson (kurs rejasi) + GroupLessonProgress (guruh qay darsda).

const WEEKDAY = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]; // 1..7 (sahifa tili nemis)

function scheduleText(weekdays: string | null, start: string | null, end: string | null) {
  const days = (weekdays ?? "")
    .split(",")
    .map((x) => WEEKDAY[Number(x.trim())] ?? "")
    .filter(Boolean)
    .join(" · ");
  const time = start ? `${start}${end ? `–${end}` : ""}` : "";
  return [days, time].filter(Boolean).join("  ·  ");
}

export default async function StudentKursePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: {
          group: {
            select: {
              id: true, name: true, levelCode: true, room: true, format: true, onlineLink: true,
              weekdays: true, startTime: true, endTime: true, startDate: true, note: true,
              programId: true,
              program: { select: { name: true, description: true } },
              // RSC leak ehtiyoti: User dan faqat kerakli maydon
              teacher: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });
  if (!student) return <MissingStudent />; // redirect("/dashboard") aylanish hosil qilardi

  const group = student.enrollments[0]?.group ?? null;

  // Guruhsiz o'quvchi — do'stona bo'sh holat
  if (!group) {
    return (
      <div className="space-y-[18px]">
        <PageHeader title="Kurse" subtitle="Dein Deutschkurs" />
        <div className={`${CARD} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
          <IconBadge s={56}><IcoBook c="white" s={28} /></IconBadge>
          <div className="text-[17px] font-extrabold text-slate-900">Noch kein Kurs</div>
          <p className="text-[13px] leading-relaxed text-slate-500">
            Siz hali guruhga biriktirilmagansiz. Administrator guruhga qo&apos;shgach, kurs shu yerda ochiladi.
          </p>
        </div>
      </div>
    );
  }

  const [lessons, progress, materials] = await Promise.all([
    prisma.courseLesson.findMany({
      where: { programId: group.programId },
      orderBy: { order: "asc" },
      select: {
        id: true, order: true, title: true, topic: true,
        videoUrl: true, materialUrl: true,
        assignment: true, assignmentFileUrl: true,
        homework: true, homeworkFileUrl: true,
      },
    }),
    prisma.groupLessonProgress.findMany({
      where: { groupId: group.id, taught: true },
      select: { courseLessonId: true, taughtAt: true },
    }),
    prisma.courseMaterial.findMany({
      where: { programId: group.programId },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, kind: true, url: true },
    }),
  ]);

  const taughtAt = new Map(progress.map((p) => [p.courseLessonId, p.taughtAt]));
  const doneCount = lessons.filter((l) => taughtAt.has(l.id)).length;
  const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
  // Joriy dars — tartib bo'yicha birinchi o'tilmagani
  const currentIdx = lessons.findIndex((l) => !taughtAt.has(l.id));
  const level = group.levelCode ?? student.currentLevel ?? "A1";
  const schedule = scheduleText(group.weekdays, group.startTime, group.endTime);

  return (
    <div className="space-y-[18px]">
      <PageHeader title="Kurse" subtitle={group.program.name} />

      {/* ── Kurs jarayoni (Start dagi "Dein Fortschritt" uslubida) ── */}
      <div className="rounded-[26px] p-6 shadow-[0_14px_30px_rgba(19,78,94,0.14)]" style={{ background: SOFT_GRADIENT }}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>{group.name}</div>
            <div className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900">
              {level} · Kapitel {Math.max(1, doneCount)}
            </div>
            <div className="mt-1 truncate text-[15px] text-slate-600">
              {doneCount}/{lessons.length} Lektionen abgeschlossen
            </div>
          </div>
          <div className="relative grid shrink-0 place-items-center">
            <Ring pct={pct} size={96} stroke={6} />
            <span className="absolute text-[20px] font-extrabold" style={{ color: NAVY }}>{pct}%</span>
          </div>
        </div>
      </div>

      {/* ── Guruh ma'lumotlari ── */}
      <div className={`${CARD} space-y-3 p-5`}>
        {group.teacher?.fullName && (
          <div className="flex items-center gap-3">
            <IcoTeacher s={20} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lehrer</div>
              <div className="truncate text-[14px] font-semibold text-slate-800">{group.teacher.fullName}</div>
            </div>
          </div>
        )}
        {schedule && (
          <div className="flex items-center gap-3">
            <IcoCalendar s={20} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Stundenplan</div>
              <div className="truncate text-[14px] font-semibold text-slate-800">{schedule}</div>
            </div>
          </div>
        )}
        {(group.room || group.format !== "OFFLINE") && (
          <div className="flex items-center gap-3">
            <IcoPin s={20} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.format === "ONLINE" ? "Online" : "Raum"}
              </div>
              {group.format === "ONLINE" && safeUrl(group.onlineLink) ? (
                <a href={safeUrl(group.onlineLink)!} target="_blank" rel="noreferrer" className="block truncate text-[14px] font-semibold underline underline-offset-2" style={{ color: TEAL }}>
                  Zum Online-Unterricht
                </a>
              ) : (
                <div className="truncate text-[14px] font-semibold text-slate-800">{group.room ?? "Online"}</div>
              )}
            </div>
          </div>
        )}
        {group.startDate && (
          <div className="flex items-center gap-3">
            <IcoClock s={20} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Kursbeginn</div>
              <div className="text-[14px] font-semibold text-slate-800">{fmtDate(group.startDate)}</div>
            </div>
          </div>
        )}
        {group.note && <p className="rounded-2xl bg-[#eef6fa] px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-600">{group.note}</p>}
      </div>

      {/* ── Kurs yo'li ── */}
      {lessons.length > 0 && (
        <>
          <SectionTitle>Dein Lernpfad</SectionTitle>
          <div className="space-y-3">
            {lessons.map((l, i) => {
              const done = taughtAt.has(l.id);
              const current = i === currentIdx;
              // safeUrl: bazadagi URL faqat http(s)/nisbiy bo'lsa havola bo'ladi
              const files = [
                { href: safeUrl(l.videoUrl), label: "Video", icon: <IcoPlay c={TEAL} s={15} /> },
                { href: safeUrl(l.materialUrl), label: "Material", icon: <IcoDoc s={15} /> },
                { href: safeUrl(l.assignmentFileUrl), label: "Aufgabe", icon: <IcoDownload s={15} /> },
                { href: safeUrl(l.homeworkFileUrl), label: "Hausaufgabe", icon: <IcoDownload s={15} /> },
              ].flatMap((f) => (f.href ? [{ href: f.href, label: f.label, icon: f.icon }] : []));

              // ── Joriy dars — ochiq, urg'uli karta ──
              if (current) {
                return (
                  <div key={l.id} className="rounded-[26px] p-5 shadow-[0_14px_30px_rgba(19,78,94,0.16)]" style={{ background: SOFT_GRADIENT }}>
                    <div className="flex items-center gap-3">
                      <IconBadge s={44}><IcoPlay c="white" s={22} /></IconBadge>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: TEAL }}>Aktuelle Lektion · {i + 1}</div>
                        <div className="truncate text-[16px] font-extrabold text-slate-900">{l.title}</div>
                      </div>
                    </div>
                    {l.topic && <p className="mt-2.5 text-[13.5px] leading-relaxed text-slate-600">{l.topic}</p>}
                    {l.homework && (
                      <div className="mt-3 rounded-2xl bg-white/80 px-3.5 py-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TEAL }}>Hausaufgabe</div>
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{l.homework}</p>
                      </div>
                    )}
                    {files.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {files.map((f) => (
                          <a key={f.label} href={f.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-[12.5px] font-bold shadow-sm" style={{ color: TEAL }}>
                            {f.icon} {f.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ── O'tilgan dars ──
              if (done) {
                return (
                  <div key={l.id} className={`${CARD} flex items-center gap-3 p-4`}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "#10b981" }}>
                      <IcoCheck s={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-bold text-slate-800">{i + 1}. {l.title}</div>
                      <div className="text-[12px] text-slate-400">{taughtAt.get(l.id) ? fmtDate(taughtAt.get(l.id)) : "Abgeschlossen"}</div>
                    </div>
                    {files.length > 0 && (
                      <div className="flex shrink-0 gap-1.5">
                        {files.map((f) => (
                          <a key={f.label} href={f.href} target="_blank" rel="noreferrer" title={f.label} className="grid h-9 w-9 place-items-center rounded-full bg-[#eef6fa]">
                            {f.icon}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ── Kelgusi dars — qulflangan ──
              return (
                <div key={l.id} className="flex items-center gap-3 rounded-[26px] bg-white/45 p-4 shadow-[0_6px_16px_rgba(19,78,94,0.05)]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-200/70 text-[14px] font-extrabold text-slate-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold text-slate-500">{l.title}</div>
                    {l.topic && <div className="truncate text-[12px] text-slate-400">{l.topic}</div>}
                  </div>
                  <IcoLock s={20} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Kurs materiallari ── */}
      {materials.length > 0 && (
        <>
          <SectionTitle>Materialien</SectionTitle>
          <div className={`${CARD} divide-y divide-slate-100 px-5 py-1`}>
            {materials.map((m) => {
              const href = safeUrl(m.url);
              const inner = (
                <>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]">
                  {m.kind === "VIDEO" ? <IcoPlay c={TEAL} s={18} /> : <IcoDoc s={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-slate-800">{m.title}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{m.kind}</div>
                </div>
                  {href && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>}
                </>
              );
              // URL kiritilmagan material havola emas
              return href ? (
                <a key={m.id} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3.5">{inner}</a>
              ) : (
                <div key={m.id} className="flex items-center gap-3 py-3.5">{inner}</div>
              );
            })}
          </div>
        </>
      )}

      {lessons.length === 0 && (
        <div className={`${CARD} px-6 py-10 text-center`}>
          <p className="text-[13px] leading-relaxed text-slate-500">Kurs rejasi hali kiritilmagan. Tez orada bu yerda darslar ro&apos;yxati paydo bo&apos;ladi.</p>
        </div>
      )}

      {/* Homework sahifasiga qisqa yo'l */}
      <Link href="/student/uben" className="block rounded-[26px] p-5 text-white shadow-[0_16px_32px_rgba(14,116,144,0.3)]" style={{ background: `linear-gradient(105deg, #0c6a86 0%, #1590b3 60%, #4cb8d6 100%)` }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[17px] font-extrabold">Zeit zum Üben! ✍️</div>
            <p className="mt-0.5 text-[12.5px] text-white/85">Hausaufgaben ansehen und abgeben</p>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </div>
      </Link>
    </div>
  );
}
