// Gemini — audio yozuvni MATNGA o'girish uchun (talaffuz mashqi).
//
// DIQQAT: modeldan "shu so'zni to'g'ri aytdimi?" deb SO'RALMAYDI. Sinovda
// shunday so'ralganda u so'rovdagi maqsad so'zga qarab rozi bo'lib ketardi
// — oddiy ohangga ham, shovqinga ham "to'g'ri aytdi" degan. Shu sabab u
// faqat eshitganini yozadi, maqsad so'z unga umuman ko'rsatilmaydi.
// Solishtirishni lib/pronounce.ts bajaradi.
//
// Kalit FAQAT serverning .env faylida (GEMINI_API_KEY). Nomi NEXT_PUBLIC_
// bilan boshlanmagani uchun u mijoz to'plamiga umuman tushmaydi.
//
// Bu fayl ATAYLAB neytral ("server-only" siz): shundagina uni Next'dan
// tashqarida sinovdan o'tkazsa bo'ladi (scripts/test-speech-e2e.ts).
// Ilova kodi esa "server-only" qo'yilgan lib/gemini.ts orqali murojaat
// qiladi — tasodifan mijozdan chaqirilsa build to'xtaydi.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Birinchisi barqaror taxallus — versiya eskirganda o'zi yangisiga o'tadi
// (gemini-2.5-flash aynan shunday "yangi foydalanuvchilarga yopiq" bo'lib
// qoldi). Band bo'lsa ikkinchisiga o'tamiz: yuklama sakrashi vaqtinchalik.
//
// Ro'yxatni .env dan almashtirsa bo'ladi (GEMINI_MODELS=a,b): model sekin
// yoki band bo'lib qolsa, buni deploy qilmasdan tuzatish mumkin.
const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-3.6-flash"];

const models = () =>
  process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? DEFAULT_MODELS;

// Bitta modelga berilgan vaqt. Qisqa audio uchun javob odatda 2-4 soniyada
// keladi; sinovda 25 soniya qo'yilganda esa band model o'sha 25 soniyani
// to'liq "yeb", keyin zaxirasi ham shuncha kutgan — jami 50 soniya. Bu
// mikrofonni bosib turgan o'quvchi uchun umuman qabul qilib bo'lmaydigan
// kutish. Endi eng yomon holat ~24 soniya va o'quvchi qayta urina oladi.
const TIMEOUT_MS = 12_000;

const PROMPT = `Transcribe this audio recording literally.

Rules:
- Write ONLY the words a human voice actually says, nothing else.
- If the recording contains no human speech at all (silence, background noise, music, a beep, a tone), return an empty string for "text" and set "speech" to false.
- Do not guess, do not complete, do not correct. Never invent words that are not clearly audible.
- The speaker is a beginner learner of German and may have a strong accent.`;

const SCHEMA = {
  type: "object",
  properties: {
    speech: { type: "boolean" },
    text: { type: "string" },
  },
  required: ["speech", "text"],
};

export const isGeminiConfigured = () => !!process.env.GEMINI_API_KEY?.trim();

export interface Transcript {
  speech: boolean;
  text: string;
}

/**
 * Audio yozuvni matnga o'giradi.
 *
 * Xato bo'lsa `null` qaytadi — chaqiruvchi buni "tekshirib bo'lmadi" deb
 * ko'rsatadi. Mashq to'xtab qolmasligi uchun istisno KO'TARILMAYDI.
 */
export async function transcribeAudio(wav: Buffer, mimeType = "audio/wav"): Promise<Transcript | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType, data: wav.toString("base64") } },
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      temperature: 0,
    },
  });

  for (const model of models()) {
    try {
      const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        // 429/503 — band yoki chegara. Keyingi modelni sinaymiz.
        console.warn("[gemini] javob bermadi:", model, res.status);
        continue;
      }

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) continue;

      const parsed = JSON.parse(raw) as Partial<Transcript>;
      return { speech: !!parsed.speech, text: String(parsed.text ?? "") };
    } catch (e) {
      console.warn("[gemini] xato:", model, e instanceof Error ? e.message : e);
    }
  }
  return null;
}
