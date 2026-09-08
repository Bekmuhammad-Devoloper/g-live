import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { lessonVocabText, parseLessonWords, practicableWords } from "@/lib/lessonWords";
import { transcribeAudio, isGeminiConfigured } from "@/lib/gemini";
import { checkPronunciation } from "@/lib/pronounce";

export const runtime = "nodejs";

// Talaffuz tekshiruvi — lug'at mashqining 4-bosqichi.
//
// O'quvchi so'zni aytadi, ilova yozuvni shu yerga yuboradi. Bu yerda:
//   1. seans va dars tekshiriladi (boshqa kursning so'zini mashq qilib
//      bo'lmasin — markLessonWatched dagi tekshiruv bilan bir xil)
//   2. MAQSAD SO'Z SERVERDA aniqlanadi. Mijoz "men shu so'zni aytdim" deb
//      yuborgan matnga ishonilmaydi: aks holda javobni o'zi yozib yuborardi.
//   3. yozuvda haqiqatan ovoz bormi — o'zimiz o'lchaymiz (pastda)
//   4. Gemini eshitganini yozadi, solishtirishni lib/pronounce.ts qiladi

const MAX_BYTES = 2 * 1024 * 1024; // ~1 daqiqalik 16kHz mono WAV dan ko'p
const MIN_BYTES = 2000;

/** Bir o'quvchi bir daqiqada nechta tekshiruv so'rashi mumkin */
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { n: number; until: number }>();

function rateLimited(studentId: string): boolean {
  const now = Date.now();
  const cur = hits.get(studentId);
  if (!cur || cur.until < now) {
    hits.set(studentId, { n: 1, until: now + RATE_WINDOW_MS });
    // Xotira o'smasin: eskirganlarni vaqti-vaqti bilan tozalaymiz
    if (hits.size > 500) for (const [k, v] of hits) if (v.until < now) hits.delete(k);
    return false;
  }
  cur.n++;
  return cur.n > RATE_LIMIT;
}

/**
 * WAV yozuvida haqiqatan gapirilganmi.
 *
 * ZARUR: sinovda Gemini MUTLAQ JIMLIKKA ham "Guten Tag" deb javob berdi.
 * Ya'ni faqat modelga tayanib bo'lmaydi — hech narsa demasdan ham bosqichni
 * o'tib ketish mumkin bo'lardi. Shuning uchun ovoz kuchini o'zimiz
 * o'lchaymiz va jim yozuvni modelga umuman yubormaymiz.
 *
 * Tekshiruv SERVERDA: mijozdagisini chetlab o'tish mumkin.
 */
function hasVoice(buf: Buffer): boolean {
  // "data" bo'lagini topamiz (WAV sarlavhasi doim 44 bayt bo'lavermaydi)
  let at = 12;
  let start = 44;
  let size = buf.length - 44;
  while (at + 8 <= buf.length) {
    const id = buf.toString("ascii", at, at + 4);
    const len = buf.readUInt32LE(at + 4);
    if (id === "data") { start = at + 8; size = Math.min(len, buf.length - start); break; }
    at += 8 + len + (len % 2);
  }
  if (size <= 0) return false;

  // 20 ms li bo'laklarga bo'lib, har birining kuchini o'lchaymiz
  const samples = Math.floor(size / 2);
  const frame = 320; // 16 kHz da 20 ms
  let loud = 0;
  let frames = 0;
  for (let i = 0; i + frame <= samples; i += frame) {
    let sum = 0;
    for (let j = 0; j < frame; j++) {
      const v = buf.readInt16LE(start + (i + j) * 2) / 32768;
      sum += v * v;
    }
    frames++;
    if (Math.sqrt(sum / frame) > 0.02) loud++; // ~ -34 dB
  }
  // Kamida 250 ms davomida ovoz bo'lsin (12 ta bo'lak)
  return frames > 0 && loud >= 12;
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const lessonId = String(form?.get("lessonId") ?? "");
  const wordIndex = Number(form?.get("wordIndex"));

  if (!(audio instanceof File) || !lessonId || !Number.isInteger(wordIndex) || wordIndex < 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (audio.size < MIN_BYTES) return NextResponse.json({ error: "no_voice" });

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

  const buf = Buffer.from(await audio.arrayBuffer());
  if (!hasVoice(buf)) return NextResponse.json({ error: "no_voice" });

  const heard = await transcribeAudio(buf);
  if (!heard) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!heard.speech || !heard.text.trim()) return NextResponse.json({ error: "no_voice" });

  const others = words.filter((_, i) => i !== wordIndex).map((w) => w.de);
  const result = checkPronunciation(word.de, heard.text, others);

  return NextResponse.json({
    ok: result.ok,
    // O'quvchi nima eshitilganini ko'rsin — "noto'g'ri" deyishdan ko'ra
    // ancha foydali, chunki xatosi qayerdaligi ko'rinadi.
    heard: heard.text.trim().slice(0, 80),
  });
}
