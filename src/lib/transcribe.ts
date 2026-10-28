const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.6-flash"];
const models = () =>
  process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? DEFAULT_MODELS;

const TIMEOUT_MS = 15_000;

export const isGeminiConfigured = () => !!process.env.GEMINI_API_KEY?.trim();

export interface Recognition {
  speech: boolean;
  transcript: string;
  chosen: string;
  confidence: number;
}

export type RecognizeResult =
  | { ok: true; value: Recognition }
  | { ok: false; reason: "quota" | "unavailable" | "not_configured" };

const SCHEMA = {
  type: "object",
  properties: {
    speech: { type: "boolean" },
    transcript: { type: "string" },
    chosen: { type: "string" },
    confidence: { type: "integer" },
  },
  required: ["speech", "transcript", "chosen", "confidence"],
};

function prompt(candidates: string[]): string {
  const list = candidates.map((c, i) => `${i + 1}. ${c}`).join("\n");
  return `You are grading a beginner's German vocabulary practice. The learner was asked to say ONE German word out loud. The word is one of the lesson words below, but you are NOT told which one.

Lesson words:
${list}

Listen to the audio and return:
- "speech": true only if a human voice actually says something. Silence, noise, music, a beep or a tone → false.
- "transcript": EXACTLY what you hear, letter by letter, in German spelling. Do not correct, complete or guess. If speech is false → "".
- "chosen": the lesson word that was clearly said, copied EXACTLY from the list (with its article). If the speaker said something that is not one of these words, or you are not sure, or speech is false → "" (empty). Do NOT pick the closest word. "" is a normal, expected answer.
- "confidence": 0-100, how sure you are that "chosen" is right. Below 60 means you are guessing.

A foreign accent, hesitation or a missing article is fine. A different word is NOT fine, even if it sounds similar.`;
}

export async function recognizeWord(wav: Buffer, candidates: string[]): Promise<RecognizeResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, reason: "not_configured" };

  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt(candidates) },
        { inline_data: { mime_type: "audio/wav", data: wav.toString("base64") } },
      ],
    }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
  });

  let sawQuota = false;
  for (const model of models()) {
    try {
      const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.status === 429) { sawQuota = true; console.warn("[gemini] kvota:", model); continue; }
      if (!res.ok) { console.warn("[gemini] javob bermadi:", model, res.status); continue; }

      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) continue;

      const p = JSON.parse(raw) as Partial<Recognition>;
      console.log("[gemini] javob berdi:", model);
      return {
        ok: true,
        value: {
          speech: !!p.speech,
          transcript: String(p.transcript ?? "").slice(0, 200),
          chosen: String(p.chosen ?? "").slice(0, 80),
          confidence: Math.max(0, Math.min(100, Math.round(Number(p.confidence) || 0))),
        },
      };
    } catch (e) {
      console.warn("[gemini] xato:", model, e instanceof Error ? e.message : e);
    }
  }
  return { ok: false, reason: sawQuota ? "quota" : "unavailable" };
}
