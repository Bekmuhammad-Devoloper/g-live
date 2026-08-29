import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../MissingStudent";
import GamePlay from "./GamePlay";
import type { WordPair } from "../BattleSetup";

// O'yin ekrani — so'zlar kurs darslarining "topic" maydonidan olinadi.

const LOBBIES = ["vocabulary", "wordgame", "crossword", "grammar"] as const;
type Lobby = (typeof LOBBIES)[number];

export default async function StudentGamePage({ searchParams }: { searchParams: Promise<{ lobby?: string }> }) {
  const sp = await searchParams;
  const lobby = (LOBBIES as readonly string[]).includes(sp.lobby ?? "") ? (sp.lobby as Lobby) : "vocabulary";

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
    ? await prisma.courseLesson.findMany({ where: { programId }, orderBy: { order: "asc" }, select: { title: true, topic: true } })
    : [];

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

  if (words.length < 4) {
    return (
      <div className="-mx-4 -mt-2 min-h-screen bg-[#f4f8ff] px-4 pt-10">
        <div className="rounded-3xl bg-white px-5 py-12 text-center shadow-sm">
          <div className="text-[15px] font-semibold text-slate-700">O'yin uchun so'zlar yetarli emas.</div>
          <p className="mt-1 text-[13px] text-slate-400">Darslarga mavzu so'zlari qo'shilgach o'ynash mumkin bo'ladi.</p>
          <Link href="/student/battle" className="mt-5 inline-block rounded-2xl bg-[#1a90ff] px-6 py-2.5 text-[15px] font-extrabold text-white">
            Orqaga
          </Link>
        </div>
      </div>
    );
  }

  // Urug' — o'yin har safar boshqacha bo'lsin, lekin server/mijoz bir xil chizsin
  const seed = words.length * 7919 + lobby.length * 104729;

  return <GamePlay words={words} lobby={lobby} seed={seed} />;
}
