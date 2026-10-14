"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { AI_TOOLS, runAiTool } from "@/lib/ai/assistantTools";
import { ASSISTANT_SYSTEM } from "@/lib/ai/assistantPrompt";
import { geminiGenerate, toGeminiTools, GeminiError, type GeminiContent } from "@/lib/ai/gemini";

// AI yordamchi — faqat rahbariyat uchun
const AI_ROLES = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];
const MODEL = "claude-opus-5-5";
const MAX_STEPS = 8; // bitta savolga vositalar bilan aylanishlar chegarasi
const MAX_HISTORY = 20;

export interface AiChatMessage { role: "user" | "assistant"; text: string }
export interface AiReply { ok: boolean; text?: string; error?: "forbidden" | "not_configured" | "failed" | "refusal"; tasksCreated?: number; chatId?: string }
export interface AiChatSummary { id: string; title: string; updatedAt: string; count: number }
type StoredMsg = AiChatMessage & { at?: number };

const MAX_CHATS = 100; // har foydalanuvchi uchun saqlanadigan suhbatlar

async function aiSession() {
  const s = await requireSession();
  return AI_ROLES.includes(s.role as never) ? s : null;
}

/** Suhbatlar tarixi (oxirgisi birinchi) */
export async function listAiChats(): Promise<AiChatSummary[]> {
  const s = await aiSession();
  if (!s) return [];
  const rows = await prisma.aiConversation.findMany({
    where: { userId: s.userId }, orderBy: { updatedAt: "desc" }, take: MAX_CHATS,
    select: { id: true, title: true, updatedAt: true, messages: true },
  });
  return rows.map((r) => {
    let count = 0;
    try { count = (JSON.parse(r.messages) as unknown[]).length; } catch { /* bo'sh */ }
    return { id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString(), count };
  });
}

export async function getAiChat(id: string): Promise<StoredMsg[] | null> {
  const s = await aiSession();
  if (!s) return null;
  const r = await prisma.aiConversation.findFirst({ where: { id, userId: s.userId }, select: { messages: true } });
  if (!r) return null;
  try { return JSON.parse(r.messages) as StoredMsg[]; } catch { return []; }
}

export async function deleteAiChat(id: string): Promise<boolean> {
  const s = await aiSession();
  if (!s) return false;
  const r = await prisma.aiConversation.deleteMany({ where: { id, userId: s.userId } });
  return r.count > 0;
}

/** Suhbatni saqlash: yangi bo'lsa yaratiladi (sarlavha — birinchi savol) */
async function saveChat(userId: string, chatId: string | null, msgs: StoredMsg[]): Promise<string> {
  const data = JSON.stringify(msgs.slice(-60));
  if (chatId) {
    const r = await prisma.aiConversation.updateMany({ where: { id: chatId, userId }, data: { messages: data } });
    if (r.count) return chatId;
  }
  const firstQ = msgs.find((m) => m.role === "user")?.text ?? "Suhbat";
  const title = firstQ.replace(/\s+/g, " ").trim().slice(0, 80);
  const c = await prisma.aiConversation.create({ data: { userId, title, messages: data }, select: { id: true } });
  // Eski suhbatlar chegaradan oshsa o'chiriladi
  const old = await prisma.aiConversation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, skip: MAX_CHATS, select: { id: true } });
  if (old.length) await prisma.aiConversation.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  return c.id;
}

/** Savol + saqlash: javob bo'lsa suhbat tarixga yoziladi */
export async function askAndSave(history: StoredMsg[], chatId: string | null): Promise<AiReply> {
  const s = await aiSession();
  if (!s) return { ok: false, error: "forbidden" };
  const r = await askAssistant(history.map(({ role, text }) => ({ role, text })));
  if (!r.ok || !r.text) return r;
  const msgs: StoredMsg[] = [...history, { role: "assistant", text: r.text, at: Date.now() }];
  const id = await saveChat(s.userId, chatId, msgs);
  return { ...r, chatId: id };
}

export async function aiAvailable(): Promise<boolean> {
  return !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
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
  // Provayder: GEMINI_API_KEY bo'lsa Gemini, aks holda Claude (ANTHROPIC_API_KEY)
  const useGemini = !!process.env.GEMINI_API_KEY;
  if (!useGemini && !process.env.ANTHROPIC_API_KEY) return { ok: false, error: "not_configured" };

  // Faqat matnli tarix (oldingi javoblarning thinking/tool bloklari qayta yuborilmaydi)
  const clean = history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length || clean[clean.length - 1].role !== "user") return { ok: false, error: "failed" };

  const actorG = { userId: s.userId, fullName: s.fullName, role: s.role };
  if (useGemini) return askGemini(clean, actorG, s.branchId);

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

const GEMINI_TOOLS = toGeminiTools(AI_TOOLS);

async function askGemini(clean: AiChatMessage[], actor: { userId: string; fullName: string; role: string }, branchId: string | null): Promise<AiReply> {
  const contents: GeminiContent[] = clean.map((m, i) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: i === clean.length - 1 ? `${todayLine()}\n${m.text}` : m.text }],
  }));
  let tasksCreated = 0;
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const r = await geminiGenerate({ system: ASSISTANT_SYSTEM, contents, tools: GEMINI_TOOLS });
      if (r.blocked) return { ok: false, error: "refusal" };
      const calls = r.parts.filter((p) => p.functionCall);
      if (calls.length === 0) {
        const text = r.parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("\n").trim();
        return { ok: true, text: text || "—", tasksCreated };
      }
      // Model javobi o'zgarishsiz (thoughtSignature bilan) qaytariladi
      contents.push({ role: "model", parts: r.parts });
      const responses = [];
      for (const c of calls) {
        const fc = c.functionCall!;
        const out = await runAiTool(fc.name, fc.args ?? {}, actor, branchId);
        if (out.wrote) tasksCreated++;
        let payload: unknown;
        try { payload = JSON.parse(out.text); } catch { payload = out.text; }
        responses.push({ functionResponse: { name: fc.name, response: out.isError ? { error: payload } : { result: payload } } });
      }
      contents.push({ role: "user", parts: responses });
    }
    return { ok: true, text: "Savol juda murakkab bo'ldi — iltimos, uni qismlarga bo'lib so'rang.", tasksCreated };
  } catch (e) {
    if (e instanceof GeminiError) {
      console.error("[ai:gemini]", e.status, e.message);
      if (e.status === 400 && /api key/i.test(e.message)) return { ok: false, error: "not_configured" };
      if (e.status === 401 || e.status === 403) return { ok: false, error: "not_configured" };
    } else console.error("[ai:gemini]", e);
    return { ok: false, error: "failed", tasksCreated };
  }
}
