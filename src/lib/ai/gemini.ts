import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Gemini (Google AI Studio) REST mijozi — function calling bilan.
 * Vositalar AI_TOOLS ro'yxatidan (bir xil sxema) o'giriladi.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thoughtSignature?: string;
  thought?: boolean;
}
export interface GeminiContent { role: "user" | "model"; parts: GeminiPart[] }

export class GeminiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Anthropic sxemasidagi vositalarni Gemini functionDeclarations ga o'girish */
export function toGeminiTools(tools: Anthropic.Beta.BetaTool[]) {
  return [{
    functionDeclarations: tools.map((t) => {
      const schema = t.input_schema as { properties?: Record<string, unknown>; required?: string[] };
      const hasProps = schema.properties && Object.keys(schema.properties).length > 0;
      return {
        name: t.name,
        description: t.description ?? "",
        ...(hasProps ? { parameters: { type: "object", properties: schema.properties, ...(schema.required?.length ? { required: schema.required } : {}) } } : {}),
      };
    }),
  }];
}

export async function geminiGenerate(params: {
  system: string;
  contents: GeminiContent[];
  tools: ReturnType<typeof toGeminiTools>;
}): Promise<{ parts: GeminiPart[]; finishReason: string | null; blocked: boolean }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError(401, "GEMINI_API_KEY yo'q");
  const res = await fetch(`${BASE}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.system }] },
      contents: params.contents,
      tools: params.tools,
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GeminiError(res.status, data?.error?.message ?? `HTTP ${res.status}`);
  const cand = data?.candidates?.[0];
  const blocked = !cand || !!data?.promptFeedback?.blockReason || cand?.finishReason === "SAFETY";
  return { parts: (cand?.content?.parts ?? []) as GeminiPart[], finishReason: cand?.finishReason ?? null, blocked };
}
