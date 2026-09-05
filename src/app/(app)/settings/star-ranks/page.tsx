import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { getStarRanks } from "@/lib/starRanks";
import { PageHeader, Forbidden } from "../../_components/ui";
import StarRanksView, { type RankRow } from "./StarRanksView";

// Yulduz pog'onalari — o'quvchi yulduz yig'ib ko'tariladigan darajalar.
// Kurs darajasi (A1/A2) bilan aralashtirmaslik uchun alohida bo'lim.
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

export default async function StarRanksSettingsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(s.locale, { uz: "Bu bo'lim menejer va rahbariyat uchun.", ru: "Этот раздел для менеджера и руководства.", en: "This section is for managers and management.", de: "Dieser Bereich ist für Manager und Leitung." })}
      />
    );
  }

  const ranks = await getStarRanks();
  const rows: RankRow[] = ranks.map((r) => ({
    id: r.id,
    nameUz: r.nameUz,
    nameRu: r.nameRu,
    nameEn: r.nameEn,
    nameDe: r.nameDe,
    stars: r.stars,
    reward: r.reward,
    color: r.color,
    iconUrl: r.iconUrl,
    isActive: r.isActive,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={tr(s.locale, { uz: "Yulduz darajalari", ru: "Звёздные уровни", en: "Star ranks", de: "Sternenstufen" })}
        subtitle={tr(s.locale, {
          uz: "O'quvchi yulduz yig'ib ko'tariladigan pog'onalar va mukofotlari",
          ru: "Ступени, которые ученик открывает за звёзды, и их награды",
          en: "The ranks students climb with stars, and their rewards",
          de: "Stufen, die Schüler mit Sternen erreichen, und ihre Belohnungen",
        })}
      />
      <StarRanksView rows={rows} locale={s.locale} />
    </div>
  );
}
