// Yopiq tanlovli Gemini baholashini HAQIQIY audio bilan sinaydi.
//
//   GEMINI_API_KEY=... npx tsx scripts/test-speech-e2e.ts
//
// Eng muhim savol: model O'YLAB TOPMAYAPTIMI? Ochiq transkripsiyada u
// jimlikka "Guten Tag", ohangga "Hund" degan edi. Bu yerda:
//   · jimlik / ohang / shovqin → speech=false yoki chosen="" bo'lishi SHART
//   · haqiqiy nutq (Gemini TTS) "die Katze" → chosen="die Katze"
//   · haqiqiy nutq "die Katze", lekin ro'yxatda Katze YO'Q → chosen=""
//
// Tashqi xizmatga murojaat qiladi (kvota sarflaydi) — build zanjirida
// EMAS, talaffuz mantig'i o'zgarganda qo'lda ishga tushiriladi.

import { recognizeWord } from "../src/lib/transcribe";
import { wavHasVoice } from "../src/lib/voiceGate";

const LESSON = ["der Hund", "die Katze", "das Haus", "das Fenster", "die Schule", "der Tisch"];
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

function wav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function synth(secs: number, fn: (i: number) => number, rate = 16000): Buffer {
  const n = rate * secs;
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(fn(i)))), i * 2);
  return wav(pcm, rate);
}

async function speak(text: string): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Say clearly in German: ${text}` }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
    }),
  });
  if (!res.ok) { console.error(`  TTS ${res.status}`); return null; }
  const j = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
  const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return b64 ? wav(Buffer.from(b64, "base64"), 24000) : null;
}

type Case = {
  name: string;
  audio: () => Promise<Buffer | null>;
  list: string[];
  wantChosen: string;
  wantSpeech?: boolean;
  /** Ovoz darvozasi (wavHasVoice) shu yozuvni to'sishi KERAKmi */
  wantGated?: boolean;
};

const CASES: Case[] = [
  // Jimlik modelga yetib bormasligi kerak — darvoza to'ssin. (Model esa
  // jimlikka "das Fenster, 95%" degan — shuning uchun darvoza zarur.)
  { name: "jimlik", audio: async () => synth(2, () => 0), list: LESSON, wantChosen: "", wantGated: true },
  // Ohang va shovqin ham darvozada to'silishi kerak: ZCR tarqalishi nutqdagidek
  // emas. (Model ohangga "der Tisch, 100%" degan edi.)
  { name: "ohang 440Hz", audio: async () => synth(2, (i) => 9000 * Math.sin(2 * Math.PI * 440 * i / 16000)), list: LESSON, wantChosen: "", wantGated: true },
  { name: "shovqin", audio: async () => synth(2, () => (Math.random() * 2 - 1) * 3000), list: LESSON, wantChosen: "", wantGated: true },
  { name: 'nutq "die Katze"', audio: () => speak("die Katze"), list: LESSON, wantChosen: "die Katze" },
  { name: 'nutq "die Katze", ro\'yxatda yo\'q', audio: () => speak("die Katze"), list: LESSON.filter((w) => w !== "die Katze"), wantChosen: "" },
];

async function main() {
  let bad = 0, skipped = 0;
  for (const c of CASES) {
    process.stdout.write(`${c.name}: `);
    const a = await c.audio();
    if (!a) { console.log("audio yo'q, o'tkazib yuborildi"); skipped++; continue; }

    // Haqiqiy quvur: avval ovoz darvozasi, keyin model
    const gated = !wavHasVoice(a);
    if (c.wantGated !== undefined) {
      const pass = gated === c.wantGated;
      if (!pass) bad++;
      console.log(`${pass ? "ok  " : "XATO"} darvoza ${gated ? "TO'SDI" : "o'tkazdi"} (kutilgan: ${c.wantGated ? "to'ssin" : "o'tkazsin"})`);
      continue;
    }
    if (gated) { console.log("XATO darvoza haqiqiy ovozni to'sdi"); bad++; continue; }

    const r = await recognizeWord(a, c.list);
    if (!r.ok) { console.log(`baholanmadi (${r.reason})`); skipped++; continue; }
    const v = r.value;
    const chosenOk = (v.chosen || "") === c.wantChosen;
    const speechOk = c.wantSpeech === undefined ? true : v.speech === c.wantSpeech;
    const pass = chosenOk && speechOk;
    if (!pass) bad++;
    console.log(`${pass ? "ok  " : "XATO"} speech=${v.speech} chosen="${v.chosen}" conf=${v.confidence} transcript="${v.transcript}"`);
  }
  console.log(bad === 0 ? `\nOK — ${CASES.length - skipped} ta holat${skipped ? `, ${skipped} tasi o'tkazib yuborildi` : ""}` : `\n${bad} ta holat mos kelmadi`);
  process.exit(bad === 0 ? 0 : 1);
}
void main();
