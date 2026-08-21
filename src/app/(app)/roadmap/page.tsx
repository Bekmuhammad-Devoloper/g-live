import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import { getSetting } from "@/lib/settings";
import RoadmapView from "./RoadmapView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

export default async function RoadmapPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Roadmap faqat rahbariyat uchun.", ru: "Roadmap доступен только руководству.", en: "The Roadmap is available only to management." })} />;
  }

  let scores: Record<string, number> = {};
  try {
    const raw = await getSetting("roadmap.scores");
    if (raw) scores = JSON.parse(raw);
  } catch { scores = {}; }

  return <RoadmapView locale={s.locale} initialScores={scores} />;
}

export const dynamic = "force-dynamic";
