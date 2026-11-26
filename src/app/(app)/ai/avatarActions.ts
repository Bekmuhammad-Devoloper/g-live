"use server";

import path from "node:path";
import { open, unlink } from "node:fs/promises";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { UPLOAD_DIR } from "@/lib/uploadFs";
import { getAiAvatarState, isUploadedAvatar, MAX_CUSTOM_AI_AVATARS, readCustomAvatars, saveChosenAvatar, saveCustomAvatars } from "@/lib/aiAvatars";
import type { AiAvatarState } from "@/lib/aiAvatarShared";

export type AiAvatarResult = { ok: true; state: AiAvatarState } | { ok: false; error: "forbidden" | "bad_file" | "limit" };

const AI_ROLES: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

async function aiUser() {
  const s = await requireSession();
  return AI_ROLES.includes(s.role) ? s : null;
}

function fileOf(url: string): string {
  return path.join(UPLOAD_DIR, path.basename(url));
}

async function isImageFile(file: string): Promise<boolean> {
  const fh = await open(file, "r").catch(() => null);
  if (!fh) return false;
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fh.read(buf, 0, 12, 0);
    if (bytesRead < 12) return false;
    const png = buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG";
    const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const gif = buf.toString("ascii", 0, 4) === "GIF8";
    const webp = buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
    return png || jpg || gif || webp;
  } finally {
    await fh.close();
  }
}

export async function chooseAiAvatar(src: string): Promise<AiAvatarResult> {
  const s = await aiUser();
  if (!s) return { ok: false, error: "forbidden" };
  const state = await getAiAvatarState(s.userId);
  if (!state.avatars.includes(src)) return { ok: true, state };
  await saveChosenAvatar(s.userId, src);
  return { ok: true, state: { ...state, chosen: src } };
}

export async function addAiAvatar(url: string): Promise<AiAvatarResult> {
  const s = await aiUser();
  if (!s) return { ok: false, error: "forbidden" };
  if (!isUploadedAvatar(url) || !(await isImageFile(fileOf(url)))) return { ok: false, error: "bad_file" };
  const list = await readCustomAvatars();
  if (!list.includes(url)) {
    if (list.length >= MAX_CUSTOM_AI_AVATARS) return { ok: false, error: "limit" };
    await saveCustomAvatars([...list, url]);
  }
  await saveChosenAvatar(s.userId, url);
  return { ok: true, state: await getAiAvatarState(s.userId) };
}

export async function removeAiAvatar(url: string): Promise<AiAvatarResult> {
  const s = await aiUser();
  if (!s) return { ok: false, error: "forbidden" };
  const list = await readCustomAvatars();
  if (list.includes(url)) {
    await saveCustomAvatars(list.filter((x) => x !== url));
    await unlink(fileOf(url)).catch(() => {});
  }
  return { ok: true, state: await getAiAvatarState(s.userId) };
}
