import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { lessonVocabText, parseLessonWords, practicableWords, splitArticle } from "@/lib/lessonWords";
import { isGeminiConfigured, recognizeWord } from "@/lib/gemini";
import { checkPronunciation, normalizeSpeech, foldUmlauts } from "@/lib/pronounce";
import { wavHasVoice } from "@/lib/voiceGate";
import { awardSkill } from "@/lib/skills";

export const runtime = "nodejs";

// Talaffuz tekshiruvi — lug'at mashqining 4-bosqichi.
//
// Ikki kirish:
//   · transcript — Android ilovasi: nutqni telefon o'zi tanigan, faqat matn
//   · audio      — brauzer: WAV yozuv, Gemini yopiq tanlov bilan baholaydi
//
// Har ikkisida ham:
//   1. seans va dars tekshiriladi (boshqa kursning so'zini mashq qilib bo'lmasin)
//   2. MAQSAD SO'Z SERVERDA aniqlanadi — mijoz faqat tartib raqamini yuboradi
//   3. yakuniy qaror shu yerda va jurnalga yoziladi

const MAX_BYTES = 2 * 1024 * 1024;
const MIN_BYTES = 2000;
/** Gemini "chosen" ga qanchalik ishonishi kerak */
const MIN_CONFIDENCE = 60;

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

/** Solishtirish uchun: artiklsiz, umlautsiz, kichik harf */
const stem = (de: string) => foldUmlauts(normalizeSpeech(splitArticle(de).rest));

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const transcript = String(form?.get("transcript") ?? "").slice(0, 300);
  const lessonId = String(form?.get("lessonId") ?? "");
  const wordIndex = Number(form?.get("wordIndex"));

  const hasAudio = audio instanceof File;
  if ((!hasAudio && !transcript.trim()) || !lessonId || !Number.isInteger(wordIndex) || wordIndex < 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (hasAudio) {
    if (!isGeminiConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
    if (audio.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
    if (audio.size < MIN_BYTES) return NextResponse.json({ error: "no_voice" });
  }

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: { id: true, enrollments: { where: { isActive: true }, select: { group: { select: { programId: true } } } } },
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

  let said: string;
  let ok: boolean;
  let via: string;

  if (hasAudio) {
    via = "audio";
    const buf = Buffer.from(await audio.arrayBuffer());
    // Jim yozuv modelga umuman yuborilmaydi (u jimlikka ham so'z "eshitadi")
    if (!wavHasVoice(buf)) return NextResponse.json({ error: "no_voice" });

    // Ro'yxat aralashtirib beriladi: maqsad so'z doim bir joyda tursa
    // model buni sezib qolishi mumkin.
    const shuffled = [...words.map((w) => w.de)].sort(() => Math.random() - 0.5);
    const r = await recognizeWord(buf, shuffled);
    if (!r.ok) {
      if (r.reason === "quota") return NextResponse.json({ error: "quota" }, { status: 429 });
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    const v = r.value;
    if (!v.speech || !v.transcript.trim()) return NextResponse.json({ error: "no_voice" });

    // UCH SHART BIRGA: model shu so'zni tanlagan bo'lsin, ishonchi yetarli
    // bo'lsin VA so'zma-so'z eshitilgani ham maqsadga mos kelsin. Bittasi
    // yetmaydi — model "chosen" da adashishi, "transcript" da esa haqiqatni
    // yozib qo'yishi mumkin (yoki aksincha).
    const chosenOk = !!v.chosen && stem(v.chosen) === stem(word.de);
    const textOk = checkPronunciation(word.de, v.transcript, others).ok;
    ok = chosenOk && textOk && v.confidence >= MIN_CONFIDENCE;
    said = v.transcript;

    console.log(
      `[pronounce] via=audio target="${word.de}" heard="${v.transcript.slice(0, 80)}" chosen="${v.chosen}" conf=${v.confidence} ok=${ok}`,
    );
  } else {
    via = "native";
    said = transcript;
    const result = checkPronunciation(word.de, transcript, others);
    ok = result.ok;
    console.log(
      `[pronounce] via=native target="${word.de}" heard="${transcript.slice(0, 80).replace(/\n/g, " ")}" ok=${ok} matched="${result.matched ?? ""}"`,
    );
  }

  // "Gapirish" ko'nikmasi — har so'z uchun bir marta (kalit dars+so'z)
  if (ok) await awardSkill(student.id, "sayWord", `say:${lessonId}:${wordIndex}`);

  return NextResponse.json({
    ok,
    // O'quvchi nima eshitilganini ko'rsin — xatosi qayerdaligi ko'rinadi.
    // Android bir nechta variant qaytarishi mumkin, birinchisini ko'rsatamiz.
    heard: said.split("|")[0].trim().slice(0, 80),
    via,
  });
}
