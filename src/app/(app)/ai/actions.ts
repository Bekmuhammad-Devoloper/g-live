"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { AI_TOOLS, runAiTool } from "@/lib/ai/assistantTools";
import { ASSISTANT_SYSTEM } from "@/lib/ai/assistantPrompt";

// AI yordamchi — faqat rahbariyat uchun
const AI_ROLES = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];
const MODEL = "claude-opus-5-5";
const MAX_STEPS = 8; // bitta savolga vositalar bilan aylanishlar chegarasi
const MAX_HISTORY = 20;

export interface AiChatMessage { role: "user" | "assistant"; text: string }
export interface AiReply { ok: boolean; text?: string; error?: "forbidden" | "not_configured" | "failed" | "refusal"; tasksCreated?: number }

export async function aiAvailable(): Promise<boolean> {
  return !!process.env.ANTHROPIC_API_KEY;
}

function todayLine(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const wd = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"][d.getDay()];
  return `[Joriy sana: ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} (${wd}), vaqt ${p(d.getHours())}:${p(d.getMinutes())}]`;
}

export async function askAssistant(history: AiChatMessage[]): Promise<AiReply> {
  const s = await requireSession();
  if (!AI_ROLES.includes(s.role as never)) return { ok: false, error: "forbidden" };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "not_configured" };

  // Faqat matnli tarix (oldingi javoblarning thinking/tool bloklari qayta yuborilmaydi)
  const clean = history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length || clean[clean.length - 1].role !== "user") return { ok: false, error: "failed" };

  const messages: Anthropic.Beta.BetaMessageParam[] = clean.map((m, i) => ({
    role: m.role,
    content: i === clean.length - 1 ? `${todayLine()}\n${m.text}` : m.text,
  }));

  const client = new Anthropic();
  const actor = { userId: s.userId, fullName: s.fullName, role: s.role };
  let tasksCreated = 0;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: ASSISTANT_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: AI_TOOLS,
        messages,
      });

      if (res.stop_reason === "refusal") return { ok: false, error: "refusal" };

      const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = res.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return { ok: true, text: text || "—", tasksCreated };
      }

      // Javobni to'liq (thinking bloklari bilan) qaytaramiz, vositalarni bajaramiz
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const r = await runAiTool(tu.name, tu.input, actor, s.branchId);
        if (r.wrote) tasksCreated++;
        results.push({ type: "tool_result", tool_use_id: tu.id, content: r.text, is_error: r.isError });
      }
      messages.push({ role: "user", content: results });
    }
    return { ok: true, text: "Savol juda murakkab bo'ldi — iltimos, uni qismlarga bo'lib so'rang.", tasksCreated };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("[ai] API kaliti noto'g'ri");
      return { ok: false, error: "not_configured" };
    }
    if (e instanceof Anthropic.APIError) console.error("[ai] API xatosi", e.status, e.message);
    else console.error("[ai]", e);
    return { ok: false, error: "failed", tasksCreated };
  }
}
