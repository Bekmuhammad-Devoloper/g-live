import "server-only";
import { prisma } from "@/lib/db";
import { BUILTIN_AI_AVATARS, type AiAvatarState } from "@/lib/aiAvatarShared";

const LIST_KEY = "ai-avatars";
const choiceKey = (userId: string) => `ai-avatar:${userId}`;

export const MAX_CUSTOM_AI_AVATARS = 24;

export function isUploadedAvatar(src: string): boolean {
  return /^\/uploads\/[A-Za-z0-9][A-Za-z0-9_-]{0,100}\.(png|jpe?g|webp|gif)$/i.test(src);
}

function parseList(raw: string | null | undefined): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && isUploadedAvatar(x)) : [];
  } catch {
    return [];
  }
}

export async function readCustomAvatars(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: LIST_KEY } });
  return parseList(row?.value);
}

export async function saveCustomAvatars(list: string[]): Promise<void> {
  const value = JSON.stringify(list);
  await prisma.setting.upsert({ where: { key: LIST_KEY }, create: { key: LIST_KEY, value }, update: { value } });
}

export async function saveChosenAvatar(userId: string, src: string): Promise<void> {
  const key = choiceKey(userId);
  await prisma.setting.upsert({ where: { key }, create: { key, value: src }, update: { value: src } });
}

export async function getAiAvatarState(userId: string): Promise<AiAvatarState> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [LIST_KEY, choiceKey(userId)] } } });
  const custom = parseList(rows.find((r) => r.key === LIST_KEY)?.value);
  const avatars = custom.length ? custom : BUILTIN_AI_AVATARS;
  const pick = rows.find((r) => r.key === choiceKey(userId))?.value ?? "";
  return { avatars, custom: custom.length > 0, chosen: avatars.includes(pick) ? pick : avatars[0] };
}
