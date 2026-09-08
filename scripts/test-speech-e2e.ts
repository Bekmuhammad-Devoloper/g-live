// Talaffuz bosqichining BUTUN zanjirini haqiqiy nutq bilan sinaydi.
//
//   GEMINI_API_KEY=... npx tsx scripts/test-speech-e2e.ts
//
// NEGA KERAK. Qoidalarni (lib/pronounce.ts) alohida sinash mumkin, lekin
// u model qaytargan matn ustida ishlaydi. Model haqiqiy nutqni qanday
// eshitishini esa faqat haqiqiy nutq bilan bilib bo'ladi. Shu sabab bu
// yerda nemis nutqi Gemini TTS bilan YARATILADI, keyin xuddi o'quvchi
// aytgandek quvurdan o'tkaziladi:
//
//   nutq -> transcribeAudio() -> checkPronunciation() -> to'g'ri/xato
//
// Sinov tashqi xizmatga murojaat qiladi, shuning uchun u `npm run build`
// zanjirida EMAS — qo'lda, talaffuz mantig'i o'zgarganda ishga tushiriladi.

// lib/gemini.ts emas, lib/transcribe.ts — birinchisida "server-only" bor
// va u Next'dan tashqarida umuman yechilmaydi (u Next'ning ichki taxallusi,
// haqiqiy paket emas). Mantiq esa ikkalasida bir xil.
import { transcribeAudio } from "../src/lib/transcribe";
import { checkPronunciation } from "../src/lib/pronounce";

const LESSON = ["der Hund", "die Katze", "das Haus", "das Fenster", "die Schule"];
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

/** Gemini TTS 24 kHz, 16-bit, mono PCM qaytaradi — WAV sarlavhasini o'zimiz qo'yamiz */
function wrapWav(pcm: Buffer, rate = 24000): Buffer {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);          // PCM
  head.writeUInt16LE(1, 22);          // mono
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/** Berilgan matnni nemis ovozida aytdiradi */
async function speak(text: string): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Say clearly in German: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        },
      }),
    },
  );
  if (!res.ok) {
    console.error(`  TTS javob bermadi: ${res.status}`);
    return null;
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
  };
  const b64 = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return b64 ? wrapWav(Buffer.from(b64, "base64")) : null;
}

/** [aytiladigan matn, tekshiriladigan maqsad so'z, qabul qilinishi kerakmi] */
const CASES: [string, string, boolean][] = [
  ["der Hund", "der Hund", true],
  ["Hund", "der Hund", true],        // artiklsiz aytdi
  ["die Katze", "der Hund", false],  // darsdagi boshqa so'z
  ["das Fenster", "das Fenster", true],
  ["die Schule", "das Haus", false], // butunlay boshqa
];

// tsx bu skriptni CJS ga o'giradi, u yerda tepa darajadagi `await`
// ishlamaydi — shu sabab hammasi funksiya ichida.
async function main() {
  let bad = 0;
  let skipped = 0;

  for (const [said, target, want] of CASES) {
    process.stdout.write(`"${said}" -> maqsad "${target}": `);
    const wav = await speak(said);
    if (!wav) { console.log("nutq yaratilmadi, o'tkazib yuborildi"); skipped++; continue; }

    const heard = await transcribeAudio(wav);
    if (!heard) { console.log("transkripsiya bo'lmadi, o'tkazib yuborildi"); skipped++; continue; }

    const others = LESSON.filter((w) => w !== target);
    const got = checkPronunciation(target, heard.text, others);
    const pass = got.ok === want;
    if (!pass) bad++;
    console.log(
      `${pass ? "ok" : "XATO"}  eshitildi="${heard.text}"  kutilgan=${want} chiqdi=${got.ok}`,
    );
  }

  console.log(
    bad === 0
      ? `\nOK — ${CASES.length - skipped} ta holat haqiqiy nutqda tekshirildi${skipped ? `, ${skipped} tasi o'tkazib yuborildi` : ""}`
      : `\n${bad} ta holat mos kelmadi`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

void main();
