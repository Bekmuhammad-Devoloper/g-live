import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { prisma } from "@/lib/db";
import { getCoinRules, getStarRules } from "@/lib/coinRules";
import { getProgressRules } from "@/lib/progressRules";
import { ATTENDED } from "@/lib/coins";
import { PageHeader, Forbidden } from "../../_components/ui";
import CoinRulesView, { type RuleRow } from "./CoinRulesView";
import ProgressRulesView from "./ProgressRulesView";

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
  const [rules, stars, prog] = await Promise.all([getCoinRules(), getStarRules(), getProgressRules()]);

  // Butun markaz bo'yicha hodisalar soni — qoida qancha tanga bergani ko'rinsin
  const [lessons, views, graded, perfect, gameWins, levelUps, spentAgg, students] = await Promise.all([
    prisma.attendance.count({ where: { status: { in: ATTENDED } } }),
    prisma.lessonView.count(),
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
      key: "lessonView", icon: "video", auto: true, events: views,
      title: L("Dars videosini ko'rgani", "За просмотр урока", "Watched the lesson", "Lektion angesehen"),
      desc: L(
        "Ilovada dars videosini ko'rib chiqqani. Yuklangan videoda 80% ko'rilganda o'zi belgilanadi, YouTube havolasida o'quvchi \"Ko'rib chiqdim\" tugmasini bosadi. Har dars uchun bir marta.",
        "Просмотр видео урока в приложении. Для загруженного видео — автоматически на 80%, для YouTube ученик нажимает кнопку. Один раз на урок.",
        "Watching the lesson video in the app. Automatic at 80% for uploaded video; for YouTube the student taps a button. Once per lesson.",
        "Ansehen des Lektionsvideos. Bei hochgeladenem Video automatisch ab 80%, bei YouTube per Knopf. Einmal pro Lektion.",
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
      title: L(`Seriya (har ${prog.streakStep} dars)`, `Серия (каждые ${prog.streakStep} уроков)`, `Streak (every ${prog.streakStep} lessons)`, `Serie (alle ${prog.streakStep} Lektionen)`),
      desc: L(
        `Ketma-ket ${prog.streakStep} dars qoldirmaganda beriladi. Bitta dars qoldirilsa seriya noldan boshlanadi.`,
        `Начисляется за ${prog.streakStep} уроков подряд без пропусков. Один пропуск обнуляет серию.`,
        `Awarded for ${prog.streakStep} lessons in a row without an absence. One absence resets the streak.`,
        `Für ${prog.streakStep} Lektionen ohne Fehlzeit. Eine Fehlzeit setzt die Serie zurück.`,
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

  const toRows = (values: typeof rules): RuleRow[] =>
    defs.map((d) => ({
      key: d.key,
      icon: d.icon,
      title: d.title,
      desc: d.desc,
      auto: d.auto,
      value: values[d.key],
      events: d.events,
      issued: d.events * values[d.key],
    }));

  const rows = toRows(rules);
  const starRows = toRows(stars);

  // Seriya bonusi o'quvchi bo'yicha hisoblanadi — umumiy summani bermaymiz
  const earned = rows.reduce((n, r) => n + r.issued, 0);
  const starEarned = starRows.reduce((n, r) => n + r.issued, 0);
  const spent = spentAgg._sum.price ?? 0;

  return (
    <div>
      <PageHeader
        title={L("Ball va mukofotlar", "Баллы и награды", "Points and rewards", "Punkte und Belohnungen")}
        subtitle={L(
          "Tanga, seriya va reyting qanday hisoblanadi",
          "Как считаются монеты, серия и рейтинг",
          "How coins, streak and rank are calculated",
          "Wie Münzen, Serie und Rangliste berechnet werden",
        )}
      />
      <h2 className="mb-3 text-base font-bold text-slate-800 dark:text-slate-100">
        {L("Tanga qoidalari", "Правила монет", "Coin rules", "Münz-Regeln")}
      </h2>
      <CoinRulesView
        kind="coin"
        unit={L("tanga", "монет", "coins", "Münzen")}
        rows={rows}
        locale={s.locale}
        stats={{ earned, spent, balance: Math.max(0, earned - spent), students }}
      />

      <h2 className="mb-3 mt-6 text-base font-bold text-slate-800 dark:text-slate-100">
        {L("Yulduz qoidalari", "Правила звёзд", "Star rules", "Sternen-Regeln")}
      </h2>
      <CoinRulesView
        kind="star"
        unit={L("yulduz", "звёзд", "stars", "Sterne")}
        rows={starRows}
        locale={s.locale}
        stats={{ earned: starEarned, spent: 0, balance: starEarned, students }}
      />

      <ProgressRulesView
        locale={s.locale}
        streakBonus={rules.streak7}
        initial={{
          streakExcusedBreaks: prog.streakExcusedBreaks,
          streakStep: prog.streakStep,
          rankScope: prog.rankScope,
          rankBasis: prog.rankBasis,
        }}
      />
    </div>
  );
}
