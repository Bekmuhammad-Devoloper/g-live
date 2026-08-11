"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { setSetting } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import { ALL_QUESTIONS } from "./roadmap-data";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR];

// Roadmap ballarini saqlash (Setting: roadmap.scores = JSON {qid: 0..10}).
export async function saveRoadmap(scores: Record<string, number>): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "Ruxsat yo'q" };

  const valid = new Set(ALL_QUESTIONS.map((q) => q.id));
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    if (!valid.has(k)) continue;
    const n = Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
    if (n > 0) clean[k] = n;
  }
  await setSetting("roadmap.scores", JSON.stringify(clean));
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Setting", entityId: "roadmap", newValue: { answered: Object.keys(clean).length } });
  revalidatePath("/roadmap");
  return { ok: true };
}
