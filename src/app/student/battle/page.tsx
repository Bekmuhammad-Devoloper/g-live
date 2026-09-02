import { redirect } from "next/navigation";
import { S } from "../_i18n";
import { getSession } from "@/lib/auth";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { prisma } from "@/lib/db";
import { gameWords, genderNouns, shortUz } from "@/lib/dictionary";
import MissingStudent from "../MissingStudent";
import Battle, { type WordPair, type Rival, type Invite } from "./Battle";
import HeaderBadges from "../HeaderBadges";

// "Jang" (Battle) — o'yin sozlash ekrani.
//
// So'zlar ikki manbadan olinadi:
//   1) o'quvchi kursidagi darslarning lug'ati (agar kiritilgan bo'lsa),
//   2) umumiy nemischa-o'zbekcha lug'at (5000 dan ortiq so'z).
// Ilgari faqat 1-manba ishlatilar edi va u ko'pincha bo'sh bo'lgani uchun
// o'yin "So'zlar yetarli emas" deb turib qolardi.

const POOL = 120; // o'yinga tayyorlanadigan so'zlar soni

export default async function StudentBattlePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await isPortalFeatureOn("battle"))) redirect("/student");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { groupId: true, group: { select: { programId: true, name: true } } },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const enrollment = student.enrollments[0] ?? null;
  const programId = enrollment?.group.programId ?? null;
  const groupId = enrollment?.groupId ?? null;

  const [lessons, mates, invites] = await Promise.all([
    programId
      ? prisma.courseLesson.findMany({
          where: { programId },
          orderBy: { order: "asc" },
          select: { title: true, topic: true },
        })
      : Promise.resolve([]),
    // Duel uchun — ilovaga ulangan guruhdoshlar
    groupId
      ? prisma.groupStudent.findMany({
          where: { groupId, isActive: true, studentId: { not: student.id }, student: { userId: { not: null } } },
          select: { student: { select: { id: true, fullName: true, imageUrl: true } } },
          take: 40,
        })
      : Promise.resolve([]),
    // Kutayotgan chaqiruvlar
    prisma.gameChallenge.findMany({
      where: {
        expiresAt: { gt: new Date() },
        OR: [
          { kind: "DUEL", opponentId: student.id },
          { kind: "DUEL", createdById: student.id },
          ...(groupId ? [{ kind: "GROUP", groupId } as const] : []),
        ],
        entries: { none: { studentId: student.id } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, kind: true, lobby: true, seed: true, createdById: true,
        createdBy: { select: { fullName: true } },
        opponent: { select: { fullName: true } },
        entries: { select: { studentId: true, score: true } },
      },
    }),
  ]);

  // ── So'zlar ──
  const words: WordPair[] = [];
  const seen = new Set<string>();
  const push = (de: string, hint: string, g?: string) => {
    const k = de.toLowerCase();
    if (de.length < 3 || seen.has(k)) return;
    seen.add(k);
    words.push({ de, hint, g });
  };

  // 1) kurs lug'ati — vergul bilan ajratilgan so'zlar
  for (const l of lessons) {
    for (const raw of (l.topic ?? "").split(/[,;\n]/)) {
      const de = raw.trim();
      if (de) push(de, l.title.replace(/^\[DEMO\]\s*/, ""));
    }
  }
  // 2) umumiy lug'atdan to'ldiramiz
  for (const w of gameWords(POOL)) {
    if (words.length >= POOL) break;
    push(w.de, shortUz(w.uz));
  }

  // Grammatika uchun rodi aniq otlar
  const nouns = genderNouns(80).map((n) => ({ de: n.de, hint: n.uz, g: n.g }));

  const rivals: Rival[] = mates.map((m) => ({
    id: m.student.id,
    name: m.student.fullName,
    imageUrl: m.student.imageUrl,
  }));

  const pending: Invite[] = invites.map((c) => ({
    id: c.id,
    kind: c.kind as "DUEL" | "GROUP",
    lobby: c.lobby,
    seed: c.seed,
    fromMe: c.createdById === student.id,
    from: c.createdBy?.fullName ?? "",
    to: c.opponent?.fullName ?? "",
    played: c.entries.length,
  }));

  return (
    <Battle
      words={words}
      nouns={nouns}
      rivals={rivals}
      invites={pending}
      groupName={enrollment?.group.name ?? null}
      badges={<HeaderBadges />}
      t={S(session.locale)}
    />
  );
}
