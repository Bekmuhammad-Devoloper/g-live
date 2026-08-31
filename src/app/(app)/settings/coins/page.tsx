import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { prisma } from "@/lib/db";
import { getCoinRules, STREAK_STEP } from "@/lib/coinRules";
import { ATTENDED } from "@/lib/coins";
import { PageHeader, Forbidden } from "../../_components/ui";
import CoinRulesView, { type RuleRow } from "./CoinRulesView";

// Tanga qoidalari — rahbariyat ko'radi va o'zgartiradi
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export default async function CoinRulesPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management.", de: "Dieser Bereich ist für die Leitung." })}
      />
    );
  }

  const L = (uz: string, ru: string, en: string, de: string) => tr(s.locale, { uz, ru, en, de });
  const rules = await getCoinRules();

  // Butun markaz bo'yicha hodisalar soni — qoida qancha tanga bergani ko'rinsin
  const [lessons, graded, perfect, gameWins, levelUps, spentAgg, students] = await Promise.all([
    prisma.attendance.count({ where: { status: { in: ATTENDED } } }),
    prisma.submission.count({ where: { status: "GRADED" } }),
    prisma.submission.findMany({
      where: { status: "GRADED" },
      select: { score: true, assignment: { select: { maxScore: true } } },
    }),
    prisma.gameResult.count({ where: { won: true } }),
    prisma.studentLevelUp.count(),
    prisma.marketOrder.aggregate({ where: { status: { not: "CANCELLED" } }, _sum: { price: true } }),
    prisma.student.count(),
  ]);

  // To'liq ballga bajarilgan vazifalar (maxScore vazifaga qarab har xil)
  const perfectCount = perfect.filter((x) => {
    const max = x.assignment?.maxScore || 0;
    return max > 0 && (x.score ?? 0) >= max;
  }).length;

  const defs: { key: keyof typeof rules; icon: string; title: string; desc: string; auto: boolean; events: number }[] = [
    {
      key: "lesson", icon: "check", auto: true, events: lessons,
      title: L("Darsga qatnashgani", "За посещённый урок", "Attended lesson", "Besuchte Lektion"),
      desc: L(
        "Davomatda kelgan deb belgilangan har bir dars (kelgan, kech qolgan, onlayn, qayta o'qigan).",
        "Каждый урок, отмеченный как посещённый (пришёл, опоздал, онлайн, отработка).",
        "Every lesson marked as attended (present, late, online, make-up).",
        "Jede als besucht markierte Lektion (anwesend, verspätet, online, Nachholstunde).",
      ),
    },
    {
      key: "homework", icon: "filecheck", auto: true, events: graded,
      title: L("Vazifa bajargani", "За проверенное задание", "Graded task", "Bewertete Aufgabe"),
      desc: L(
        "Topshirgan uy vazifasi o'qituvchi tomonidan baholanganda beriladi.",
        "Начисляется, когда преподаватель проверил сданное задание.",
        "Awarded once the teacher grades a submitted task.",
        "Wird vergeben, sobald die Lehrkraft die Aufgabe bewertet hat.",
      ),
    },
    {
      key: "perfect", icon: "award", auto: true, events: perfectCount,
      title: L("To'liq ballga bajargani", "За максимальный балл", "Perfect score", "Volle Punktzahl"),
      desc: L(
        "Vazifa uchun yuqoridagi tangaga QO'SHIMCHA — maksimal ball olingan bo'lsa.",
        "ДОПОЛНИТЕЛЬНО к монетам за задание, если набран максимальный балл.",
        "Extra, on top of the task coins, when the maximum score is reached.",
        "Zusätzlich zu den Aufgaben-Münzen bei voller Punktzahl.",
      ),
    },
    {
      key: "gameWin", icon: "trophy", auto: true, events: gameWins,
      title: L("O'yinda yutgani", "За победу в игре", "Game win", "Spielsieg"),
      desc: L(
        `"Jang" bo'limida g'alaba. Kuniga 20 tagacha o'yin sanaladi.`,
        "Победа в разделе «Битва». Засчитывается до 20 игр в день.",
        "A win in the Battle section. Up to 20 games a day are counted.",
        "Ein Sieg im Bereich „Kampf“. Bis zu 20 Spiele pro Tag zählen.",
      ),
    },
    {
      key: "streak7", icon: "history", auto: true, events: 0,
      title: L(`Seriya (har ${STREAK_STEP} dars)`, `Серия (каждые ${STREAK_STEP} уроков)`, `Streak (every ${STREAK_STEP} lessons)`, `Serie (alle ${STREAK_STEP} Lektionen)`),
      desc: L(
        `Ketma-ket ${STREAK_STEP} dars qoldirmaganda beriladi. Bitta dars qoldirilsa seriya noldan boshlanadi.`,
        `Начисляется за ${STREAK_STEP} уроков подряд без пропусков. Один пропуск обнуляет серию.`,
        `Awarded for ${STREAK_STEP} lessons in a row without an absence. One absence resets the streak.`,
        `Für ${STREAK_STEP} Lektionen ohne Fehlzeit. Eine Fehlzeit setzt die Serie zurück.`,
      ),
    },
    {
      key: "levelUp", icon: "layers", auto: true, events: levelUps,
      title: L("Yangi darajaga ko'tarilgani", "За переход на новый уровень", "Level up", "Neues Niveau"),
      desc: L(
        "O'quvchining darajasi yuqoriga o'zgarganda (A1 → A2). Har daraja uchun bir marta.",
        "Когда уровень ученика повышается (A1 → A2). Один раз на уровень.",
        "When the student's level moves up (A1 → A2). Once per level.",
        "Wenn das Niveau steigt (A1 → A2). Einmal pro Niveau.",
      ),
    },
  ];

  const rows: RuleRow[] = defs.map((d) => ({
    key: d.key,
    icon: d.icon,
    title: d.title,
    desc: d.desc,
    auto: d.auto,
    value: rules[d.key],
    events: d.events,
    issued: d.events * rules[d.key],
  }));

  // Seriya bonusi o'quvchi bo'yicha hisoblanadi — umumiy summani bermaymiz
  const earned = rows.reduce((n, r) => n + r.issued, 0);
  const spent = spentAgg._sum.price ?? 0;

  return (
    <div>
      <PageHeader
        title={L("Tanga qoidalari", "Правила монет", "Coin rules", "Münz-Regeln")}
        subtitle={L(
          "O'quvchi nima uchun necha tanga oladi",
          "За что и сколько монет получает ученик",
          "What earns a student coins, and how many",
          "Wofür und wie viele Münzen ein Schüler erhält",
        )}
      />
      <CoinRulesView
        rows={rows}
        locale={s.locale}
        stats={{ earned, spent, balance: Math.max(0, earned - spent), students }}
      />
    </div>
  );
}
