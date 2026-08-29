import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../MissingStudent";
import { PageHeader } from "../_ui";
import WordList, { type VWord } from "./WordList";

// Lug'at — o'quvchi kursidagi barcha darslarning so'zlari bir joyda.
// Manba: CourseLesson.topic (vergul bilan ajratilgan ro'yxat). Agar ustoz
// "das Haus - uy" ko'rinishida yozsa, tarjima ham ajratib ko'rsatiladi.

const clean = (s: string) => s.replace(/^\[DEMO\]\s*/, "").trim();

export default async function StudentWorterbuchPage() {
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
        select: { group: { select: { id: true, levelCode: true, programId: true, program: { select: { name: true } } } } },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;

  const [lessons, progress] = await Promise.all([
    group
      ? prisma.courseLesson.findMany({
          where: { programId: group.programId },
          orderBy: { order: "asc" },
          select: { id: true, title: true, topic: true, levelCode: true },
        })
      : Promise.resolve([]),
    group
      ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } })
      : Promise.resolve([]),
  ]);

  const taught = new Set(progress.map((p) => p.courseLessonId));
  const fallback = (group?.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();

  const words: VWord[] = [];
  const seen = new Set<string>();
  for (const l of lessons) {
    for (const raw of (l.topic ?? "").split(/[,;\n]/)) {
      const part = raw.trim();
      if (part.length < 2) continue;
      // "das Haus - uy" / "das Haus — uy" / "das Haus – uy"
      const m = part.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      const de = (m ? m[1] : part).trim();
      const uz = m ? m[2].trim() : null;
      const key = de.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      words.push({
        de,
        uz,
        lesson: clean(l.title),
        level: (l.levelCode ?? fallback).toUpperCase(),
        learned: taught.has(l.id),
      });
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Wörterbuch"
        subtitle={group ? `${words.length} so'z · ${group.program.name}` : "Lug'at"}
        back="/student/kurse"
      />
      <WordList words={words} />
    </div>
  );
}
