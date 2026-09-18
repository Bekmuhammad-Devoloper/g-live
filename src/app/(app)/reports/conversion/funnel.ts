// Konversiya voronkasi — API (/api/reports/conversion) va UI uchun UMUMIY qoida.
//
//   • Voronka YIG'MA: bosqichga "yetgan" = hozirgi bosqichi shu yoki undan keyingi
//     (Qabul qilingan lid hamma bosqichdan o'tgan hisoblanadi).
//   • Yo'qotilgan lid faqat "So'rovlar"da sanaladi (qayerga yetgani noma'lum).
//   • Konversiya = Qabul qilinganlar / So'rovlar × 100.

export const STAGE_ORDER = ["NEW", "IN_PROGRESS", "CONTACTED", "TEST", "OFFER", "AWAITING_PAYMENT", "PAID", "WON"] as const;
const rank = (stage: string) => STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);

export const FUNNEL_STEPS = [
  { key: "sorovlar", min: "NEW", label: { uz: "So'rovlar", ru: "Заявки", en: "Requests", de: "Anfragen" } },
  { key: "ishlov", min: "IN_PROGRESS", label: { uz: "Ishlovga olindi", ru: "Взяты в работу", en: "In progress", de: "In Bearbeitung" } },
  { key: "test", min: "TEST", label: { uz: "Daraja testi", ru: "Тест уровня", en: "Level test", de: "Einstufungstest" } },
  { key: "taklif", min: "OFFER", label: { uz: "Taklif", ru: "Предложение", en: "Offer", de: "Angebot" } },
  { key: "tolov", min: "AWAITING_PAYMENT", label: { uz: "To'lov bosqichi", ru: "Этап оплаты", en: "Payment stage", de: "Zahlungsphase" } },
  { key: "qabul", min: "PAID", label: { uz: "Qabul qilindi", ru: "Приняты", en: "Enrolled", de: "Aufgenommen" } },
] as const;
export type StepKey = (typeof FUNNEL_STEPS)[number]["key"];

/** Lid berilgan voronka bosqichiga yetganmi (yig'ma) */
export function reached(l: { stage: string; studentId: string | null }, key: StepKey | "yoqotilgan"): boolean {
  if (key === "sorovlar") return true;
  if (key === "yoqotilgan") return l.stage === "LOST";
  if (key === "qabul") return l.stage === "WON" || l.stage === "PAID" || !!l.studentId;
  if (l.stage === "LOST") return false;
  const min = FUNNEL_STEPS.find((s) => s.key === key)!.min;
  return rank(l.stage) >= rank(min);
}
