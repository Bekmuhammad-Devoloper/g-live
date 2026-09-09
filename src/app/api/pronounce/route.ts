import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { lessonVocabText, parseLessonWords, practicableWords } from "@/lib/lessonWords";
import { checkPronunciation } from "@/lib/pronounce";

export const runtime = "nodejs";

// Talaffuz tekshiruvi — lug'at mashqining 4-bosqichi.
//
// Nutqni telefonning o'zi taniydi (NativeSpeechPlugin) va bu yerga faqat
// tanilgan MATN keladi. Bu yerda:
//   1. seans va dars tekshiriladi (boshqa kursning so'zini mashq qilib
//      bo'lmasin — markLessonWatched dagi tekshiruv bilan bir xil)
//   2. MAQSAD SO'Z SERVERDA aniqlanadi. Mijoz "men shu so'zni aytdim" deb
//      yuborgan matnga ishonilmaydi: u faqat tartib raqamini yuboradi.
//   3. solishtirishni lib/pronounce.ts bajaradi — qoidalar bitta joyda
//
// ILGARI audio ham qabul qilinardi (brauzerda yozib olib, Gemini orqali
// matnga o'girish). Olib tashlandi: Gemini noto'g'ri aytilganini "to'g'ri"
// deb o'tkazardi (o'ylab topadi), kvotasi kuniga 20 ta, javobi ~30 s.

/** Bir o'quvchi bir daqiqada nechta tekshiruv so'rashi mumkin */
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { n: number; until: number }>();

function rateLimited(studentId: string): boolean {
  const now = Date.now();
  const cur = hits.get(studentId);
  if (!cur || cur.until < now) {
    hits.set(studentId, { n: 1, until: now + RATE_WINDOW_MS });
    if (hits.size > 500) for (const [k, v] of hits) if (v.until < now) hits.delete(k);
    return false;
  }
  cur.n++;
  return cur.n > RATE_LIMIT;
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const transcript = String(form?.get("transcript") ?? "").slice(0, 300);
  const lessonId = String(form?.get("lessonId") ?? "");
  const wordIndex = Number(form?.get("wordIndex"));

  if (!transcript.trim() || !lessonId || !Number.isInteger(wordIndex) || wordIndex < 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: {
      id: true,
      enrollments: { where: { isActive: true }, select: { group: { select: { programId: true } } } },
    },
  });
  if (!student) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(student.id)) return NextResponse.json({ error: "slow_down" }, { status: 429 });

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { programId: true, topic: true, vocabText: true },
  });
  if (!lesson) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!student.enrollments.some((e) => e.group.programId === lesson.programId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Maqsad so'z SERVERDA aniqlanadi — mijoz aytganiga ishonilmaydi
  const words = practicableWords(parseLessonWords(lessonVocabText(lesson)));
  const word = words[wordIndex];
  if (!word) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const others = words.filter((_, i) => i !== wordIndex).map((w) => w.de);
  const result = checkPronunciation(word.de, transcript, others);

  // QAROR jurnalga yoziladi: nima kutilgan, nima eshitilgan, nima deyilgan.
  // "Noto'g'ri aytsam ham to'g'ri deydi" degan shikoyatni faqat shu bilan
  // tekshirib bo'ladi — qurilma ham, mikrofon ham bizda yo'q.
  console.log(
    `[pronounce] target="${word.de}" heard="${transcript.slice(0, 80).replace(/\n/g, " ")}" ok=${result.ok} matched="${result.matched ?? ""}"`,
  );

  return NextResponse.json({
    ok: result.ok,
    // O'quvchi nima eshitilganini ko'rsin — "noto'g'ri" deyishdan ko'ra
    // foydali, xatosi qayerdaligi ko'rinadi. Android bir nechta variant
    // qaytarishi mumkin, birinchisini ko'rsatamiz.
    heard: transcript.split("|")[0].trim().slice(0, 80),
  });
}
