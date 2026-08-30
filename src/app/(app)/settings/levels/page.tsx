import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { prisma } from "@/lib/db";
import { getStudyLevels } from "@/lib/studyLevels";
import { PageHeader, Forbidden } from "../../_components/ui";
import LevelsView, { type LevelRow } from "./LevelsView";

// Daraja katalogi — A1, A2, B1 ... butun tizim shu ro'yxatdan oladi
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

export default async function LevelsSettingsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(s.locale, { uz: "Bu bo'lim menejer va rahbariyat uchun.", ru: "Этот раздел для менеджера и руководства.", en: "This section is for managers and management.", de: "Dieser Bereich ist für Manager und Leitung." })}
      />
    );
  }

  const levels = await getStudyLevels();

  // Har daraja nechta joyda ishlatilgan — o'chirishdan oldin ko'rinib tursin
  const codes = levels.map((l) => l.code);
  const [lessons, groups, materials, certs] = await Promise.all([
    prisma.courseLesson.groupBy({ by: ["levelCode"], where: { levelCode: { in: codes } }, _count: { _all: true } }),
    prisma.group.groupBy({ by: ["levelCode"], where: { levelCode: { in: codes } }, _count: { _all: true } }),
    prisma.courseMaterial.groupBy({ by: ["levelCode"], where: { levelCode: { in: codes } }, _count: { _all: true } }),
    prisma.certificate.groupBy({ by: ["levelCode"], where: { levelCode: { in: codes } }, _count: { _all: true } }),
  ]);

  const usage = new Map<string, number>();
  for (const set of [lessons, groups, materials, certs]) {
    for (const r of set) {
      if (!r.levelCode) continue;
      usage.set(r.levelCode, (usage.get(r.levelCode) ?? 0) + r._count._all);
    }
  }

  const rows: LevelRow[] = levels.map((l) => ({ ...l, usage: usage.get(l.code) ?? 0 }));

  return (
    <div>
      <PageHeader
        title={tr(s.locale, { uz: "Darajalar", ru: "Уровни", en: "Levels", de: "Niveaus" })}
        subtitle={tr(s.locale, {
          uz: "A1, A2, B1 ... — nomi, rangi, banneri va tartibi",
          ru: "A1, A2, B1 ... — название, цвет, баннер и порядок",
          en: "A1, A2, B1 ... — name, colour, banner and order",
          de: "A1, A2, B1 ... — Name, Farbe, Banner und Reihenfolge",
        })}
      />
      <LevelsView rows={rows} locale={s.locale} />
    </div>
  );
}
