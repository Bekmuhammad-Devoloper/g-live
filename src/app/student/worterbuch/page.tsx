import Link from "next/link";
import { S, type StudentStrings } from "../_i18n";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ARTICLE, DICT_LETTERS, DICT_SIZE, searchDict, type DictEntry } from "@/lib/dictionary";
import MissingStudent from "../MissingStudent";
import { CARD, ICON_GRADIENT, PageHeader } from "../_ui";
import DictNav from "./DictNav";
import WordList, { type VWord } from "./WordList";

// Wörterbuch — ikki manba:
//   "Kursim" — o'quvchi darslaridagi so'zlar (CourseLesson.topic)
//   "Lug'at" — bosma nemischa-o'zbekcha lug'atdan raqamlashtirilgan baza
// Katta lug'at brauzerga yuborilmaydi: qidiruv serverda bajariladi.

const clean = (s: string) => s.replace(/^\[DEMO\]\s*/, "").trim();
const PAGE = 60;

type SP = Promise<{ tab?: string; q?: string; l?: string; n?: string }>;

export default async function StudentWorterbuchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab === "lugat" ? "lugat" : "kurs";

  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { group: { select: { id: true, levelCode: true, programId: true, program: { select: { name: true } } } } },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;

  const [lessons, progress] = await Promise.all([
    group
      ? prisma.courseLesson.findMany({
          where: { programId: group.programId },
          orderBy: { order: "asc" },
          select: { id: true, title: true, topic: true, levelCode: true },
        })
      : Promise.resolve([]),
    group
      ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } })
      : Promise.resolve([]),
  ]);

  const taught = new Set(progress.map((p) => p.courseLessonId));
  const fallback = (group?.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();

  const words: VWord[] = [];
  const seen = new Set<string>();
  for (const l of lessons) {
    for (const raw of (l.topic ?? "").split(/[,;\n]/)) {
      const part = raw.trim();
      if (part.length < 2) continue;
      const m = part.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      const de = (m ? m[1] : part).trim();
      const uz = m ? m[2].trim() : null;
      const key = de.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      words.push({
        de,
        uz,
        lesson: clean(l.title),
        level: (l.levelCode ?? fallback).toUpperCase(),
        learned: taught.has(l.id),
      });
    }
  }

  // ── Umumiy lug'at ──
  const limit = Math.min(Number(sp.n) || PAGE, 600);
  const res = tab === "lugat" ? searchDict({ q: sp.q, letter: sp.l, limit }) : null;

  const moreHref = () => {
    const p = new URLSearchParams({ tab: "lugat" });
    if (sp.q) p.set("q", sp.q);
    if (sp.l) p.set("l", sp.l);
    p.set("n", String(Math.min(limit + PAGE * 4, 600)));
    return "?" + p.toString();
  };

  const fmt = (n: number) => n.toLocaleString("de-DE");

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.dictionary}
        subtitle={
          tab === "lugat"
            ? fmt(DICT_SIZE) + " " + t.wordsCount
            : group
              ? words.length + " " + t.wordsCount + " · " + group.program.name
              : t.dictionary
        }
        back="/student/kurse"
      />

      {/* Manba tanlash */}
      <div className="flex gap-2 rounded-2xl bg-white/70 p-1.5 shadow-[0_6px_16px_rgba(19,78,94,0.08)]">
        <Tab href="/student/worterbuch" active={tab === "kurs"} label={t.myCourse} sub={String(words.length)} />
        <Tab href="/student/worterbuch?tab=lugat" active={tab === "lugat"} label={t.fullDictionary} sub={fmt(DICT_SIZE)} />
      </div>

      {tab === "kurs" ? (
        <WordList words={words} t={t} />
      ) : (
        <>
          <DictNav letters={DICT_LETTERS} t={t} />

          <div className="flex items-center justify-between px-1">
            <span className="text-[12.5px] font-semibold text-slate-500">
              {res!.total === 0 ? t.notFound : fmt(res!.total) + " " + t.wordsCount}
            </span>
            {sp.q ? <span className="ml-3 truncate text-[12px] text-slate-400">{sp.q}</span> : null}
          </div>

          {res!.total === 0 ? (
            <div className={CARD + " px-5 py-12 text-center"}>
              <div className="text-[15px] font-semibold text-slate-700">{t.notFound}</div>
              <p className="mt-1 text-[13px] text-slate-400">
                {t.tryAnother}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {groupByLetter(res!.items, !!sp.q).map(([letter, list]) => (
                <div key={letter} className={CARD + " overflow-hidden"}>
                  {letter ? (
                    <div className="flex items-center gap-2.5 bg-slate-50/70 px-4 py-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[12px] font-extrabold text-white" style={{ background: ICON_GRADIENT }}>
                        {letter}
                      </span>
                      <span className="text-[11.5px] font-semibold text-slate-400">{list.length}</span>
                    </div>
                  ) : null}
                  <ul>
                    {list.map((e) => (
                      <Row key={e.de} e={e} t={t} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {res!.total > res!.items.length ? (
            <Link
              href={moreHref()}
              scroll={false}
              className={CARD + " block px-4 py-3.5 text-center text-[14px] font-bold text-slate-600"}
            >
              {t.showMore} ({fmt(res!.total - res!.items.length)})
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

function Tab({ href, active, label, sub }: { href: string; active: boolean; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className={
        "flex flex-1 flex-col items-center rounded-xl py-2 transition " +
        (active ? "bg-white shadow-[0_4px_12px_rgba(19,78,94,0.12)]" : "")
      }
    >
      <span className={"text-[14px] font-extrabold " + (active ? "text-slate-900" : "text-slate-400")}>{label}</span>
      <span className={"text-[11px] font-semibold " + (active ? "text-[#0e7490]" : "text-slate-400")}>{sub}</span>
    </Link>
  );
}

// Artikl rangi — der/die/das ni yodda saqlash uchun eng foydali ko'rsatma
const ART_STYLE: Record<string, { bg: string; fg: string }> = {
  der: { bg: "#dbeafe", fg: "#1d4ed8" },
  die: { bg: "#ffe4e6", fg: "#be123c" },
  das: { bg: "#d1fae5", fg: "#047857" },
};

// Qidiruvda tekis ro'yxat, ko'rib chiqishda harf bo'limlari bilan
function groupByLetter(items: DictEntry[], flat: boolean): [string, DictEntry[]][] {
  if (flat) return [["", items]];
  const map = new Map<string, DictEntry[]>();
  for (const e of items) {
    const arr = map.get(e.l);
    if (arr) arr.push(e);
    else map.set(e.l, [e]);
  }
  return [...map.entries()];
}

const POS_KEY: Record<string, keyof StudentStrings> = {
  vt: "posVerb",
  vi: "posVerb",
  adj: "posAdj",
  adv: "posAdv",
  num: "posNum",
  pron: "posPron",
  "präp": "posPrep",
  konj: "posConj",
  int: "posInt",
};

// Bosma lug'atda ma'nolar "1) ... 2) ..." tarzida bir qatorga yozilgan —
// ekranda ularni alohida qatorlarga ajratsak o'qish ancha oson.
function Senses({ uz }: { uz: string }) {
  const parts = uz
    .split(/\s*\d\)\s*/)
    .map((x) => x.trim().replace(/[;,]$/, ""))
    .filter(Boolean);

  if (parts.length < 2) {
    return <div className="mt-0.5 text-[14px] leading-snug text-slate-600">{uz}</div>;
  }

  return (
    <ol className="mt-1 space-y-[3px]">
      {parts.map((x, i) => (
        <li key={i} className="flex gap-1.5 text-[14px] leading-snug text-slate-600">
          <span className="mt-[1px] shrink-0 text-[11px] font-bold text-slate-300">{i + 1}</span>
          <span className="min-w-0">{x}</span>
        </li>
      ))}
    </ol>
  );
}

function Row({ e, t }: { e: DictEntry; t: StudentStrings }) {
  const art = e.g ? ARTICLE[e.g] : null;
  const st = art ? ART_STYLE[art] : null;
  const pos = e.p ? t[POS_KEY[e.p] ?? "posVerb"] : null;

  return (
    <li className="flex gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
      {/* Chap ustun: artikl yoki so'z turkumi */}
      <div className="w-[46px] shrink-0 pt-[3px]">
        {st ? (
          <span
            className="grid h-[26px] place-items-center rounded-lg text-[12px] font-extrabold"
            style={{ background: st.bg, color: st.fg }}
          >
            {art}
          </span>
        ) : (
          <span className="grid h-[26px] place-items-center rounded-lg bg-slate-50 text-[10.5px] font-bold text-slate-400">
            {pos ?? ""}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[16px] font-extrabold leading-tight text-slate-900">{e.de}</span>
          {e.f ? <span className="font-mono text-[11.5px] text-slate-400">{e.f}</span> : null}
          {e.s ? (
            <span className="rounded bg-slate-100 px-1.5 py-[1px] text-[10.5px] font-semibold text-slate-500">{e.s}.</span>
          ) : null}
        </div>
        <Senses uz={e.uz} />
      </div>
    </li>
  );
}
