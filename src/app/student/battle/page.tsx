import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../MissingStudent";
import BattleSetup, { type WordPair } from "./BattleSetup";

// "Jang" (Battle) — o'yin sozlash ekrani.
// So'zlar o'quvchi kursidagi darslarning "topic" maydonidan olinadi
// (vergul/nuqta-vergul bilan ajratilgan lug'at ro'yxati).

export default async function StudentBattlePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { group: { select: { programId: true } } },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const programId = student.enrollments[0]?.group.programId ?? null;
  const lessons = programId
    ? await prisma.courseLesson.findMany({
        where: { programId },
        orderBy: { order: "asc" },
        select: { title: true, topic: true },
      })
    : [];

  // "topic" — vergul bilan ajratilgan so'zlar; har biri savolga aylanadi
  const words: WordPair[] = [];
  const seen = new Set<string>();
  for (const l of lessons) {
    for (const raw of (l.topic ?? "").split(/[,;\n]/)) {
      const de = raw.trim();
      if (de.length < 2 || seen.has(de.toLowerCase())) continue;
      seen.add(de.toLowerCase());
      words.push({ de, hint: l.title.replace(/^\[DEMO\]\s*/, "") });
    }
  }

  return <BattleSetup words={words} />;
}
