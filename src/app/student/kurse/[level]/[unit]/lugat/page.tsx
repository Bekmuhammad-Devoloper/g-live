import MissingStudent from "../../../../MissingStudent";
import { loadUnit } from "../_load";
import { SectionHeader, IcoWords, Attachment } from "../_parts";
import { lessonVocabText, looksLikeVocabulary, parseLessonWords, practicableWords, type LessonWord } from "@/lib/lessonWords";
import { loadUnitProgress } from "../_progress";
import { NAVY } from "../../../../_ui";
import VocabTrainer from "./VocabTrainer";

// Darsning lug'ati.
//
// So'zlarni ustoz "Lug'at" maydoniga "der Hund - it" ko'rinishida yozadi
// (eski darslarda — "Mavzu" maydoniga). Ajratish mantig'i lib/lessonWords.ts
// da: dars sahifasi, "So'zlar" bo'limi va shu sahifa bitta manbadan oladi.
//
// Sahifa uch qismdan iborat: yuqorida holat va mashq tugmasi, keyin ustoz
// yuklagan fayl (bo'lsa), pastda so'zlar ro'yxati.

const ACCENT = "linear-gradient(150deg, #f6c453 0%, #e09217 100%)";
const ACCENT_SOLID = "linear-gradient(135deg, #e8a52a 0%, #d4820f 100%)";

// Artikl rangi — nemis tilida ot artikli bilan yodlanadi. Rang jinsni
// bir qarashda ajratib beradi: takror ko'rgan sari "die Katze" ning
// pushti artikli esda qoladi, artiklsiz so'z esa keyin gapda xato beradi.
const ARTICLE: Record<string, { fg: string }> = {
  der: { fg: "#1d4ed8" }, // ko'k
  die: { fg: "#be185d" }, // pushti
  das: { fg: "#047857" }, // yashil
};

/** "der Hund" -> artikl va otni ajratadi; artikl bo'lmasa null */
function splitArticle(de: string): { article: string | null; rest: string } {
  const m = /^(der|die|das)\s+(.+)$/i.exec(de.trim());
  if (!m) return { article: null, rest: de };
  return { article: m[1].toLowerCase(), rest: m[2] };
}

export default async function LessonVocabPage({
  params,
}: {
  params: Promise<{ level: string; unit: string }>;
}) {
  const { level, unit } = await params;
  const ctx = await loadUnit(level, unit);
  if (ctx.missing) return <MissingStudent />;

  const { t, code, lesson, unitLabel } = ctx;
  const words = parseLessonWords(lessonVocabText(lesson));
  const hasVocab = words.length > 0 && looksLikeVocabulary(words);
  const p = await loadUnitProgress(ctx);
  const canPractise = practicableWords(words).length >= 2;

  return (
    <div>
      <SectionHeader
        backHref={`/student/kurse/${code}/${lesson.id}`}
        backLabel={t.back}
        title={t.vocabulary}
        subtitle={`${unitLabel} · ${lesson.title}`}
        accent={ACCENT}
      />

      {/* ── Holat va mashq ──
          Ilgari bu yerda faqat ingichka foiz chizig'i turardi va o'quvchi
          uni o'zi to'ldira olmasdi — dars o'tilishini kutardi. Endi mashq
          shu yerdan boshlanadi. */}
      {hasVocab && (
        <section
          className="relative mt-4 overflow-hidden rounded-[26px] p-5 text-white shadow-[0_14px_30px_-14px_rgba(180,110,10,0.85)]"
          style={{ background: ACCENT_SOLID }}
        >
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 opacity-[0.16]">
            <IcoWords s={130} />
          </span>

          <div className="relative flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/22 backdrop-blur-sm">
              <IcoWords s={26} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/70">
                {t.vocabulary}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[30px] font-extrabold leading-none tracking-tight">{words.length}</span>
                <span className="text-[13px] font-semibold text-white/75">{t.wordCount}</span>
              </div>
            </div>
            {p.vocab.mastered && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/22 px-3 py-1.5 text-[11.5px] font-extrabold backdrop-blur-sm">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4.5 12.5 5 5 10-11" />
                </svg>
                {t.vocabLearned}
              </span>
            )}
          </div>

          <div className="relative mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-[11.5px]">
              <span className="font-semibold text-white/80">
                {p.vocab.mastered ? t.vocabMasteredNote : t.practiceHint}
              </span>
              <span className="shrink-0 font-extrabold tabular-nums">{p.vocab.pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${p.vocab.pct}%` }} />
            </div>
          </div>

          {canPractise ? (
            <VocabTrainer
              words={words}
              lessonId={lesson.id}
              t={t}
              accent={ACCENT_SOLID}
              label={p.vocab.mastered ? t.practiceAgain : t.practiceWords}
            />
          ) : (
            <p className="relative mt-3 text-[12px] font-medium text-white/70">{t.vocabTooFew}</p>
          )}
        </section>
      )}

      {/* Ustoz yuklagan lug'at fayli (pdf/word/txt). So'zlar ro'yxatiga
          QO'SHIMCHA — ikkalasi ham bo'lishi mumkin, birortasi ham. */}
      {lesson.vocabFileUrl && (
        <section className="gl-glass mt-3 rounded-[26px] px-4 pb-4 pt-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-white" style={{ background: ACCENT }}>
              <IcoWords s={21} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-extrabold text-slate-900">{t.vocabFile}</span>
              <span className="block truncate text-[12px] text-slate-500">{t.vocabFileHint}</span>
            </span>
          </div>
          <Attachment url={lesson.vocabFileUrl} tint="rgba(246,196,83,0.18)" accent="#e09217" t={t} />
        </section>
      )}

      {hasVocab ? (
        <section className="gl-glass mt-3 overflow-hidden rounded-[26px]">
          <ul>
            {words.map((w, i) => (
              <WordRow key={w.de} word={w} index={i + 1} />
            ))}
          </ul>
        </section>
      ) : lesson.vocabFileUrl ? null : (
        <div className="gl-glass mt-4 rounded-[26px] px-5 py-14 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/60 text-slate-400">
            <IcoWords s={26} />
          </span>
          <div className="text-[14.5px] font-semibold text-slate-700">{t.noWordsInLesson}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Bitta so'z qatori — IKKI USTUN: chapda nemischa, o'ngda tarjimasi.
 *
 * Ikkisini ustma-ust qo'yib ham ko'rilgan edi, lekin yonma-yon turgani
 * yaxshiroq: ko'z bir qatorda ikkalasini birdan oladi va ro'yxat ikki
 * baravar kalta bo'ladi.
 *
 * Artikl rangi saqlanadi (der ko'k, die pushti, das yashil), lekin fon
 * berilgan "chip" emas — tor ustunda chip so'zni ikkinchi qatorga surib
 * yuborardi. Rangli yozuvning o'zi ham jinsni bir qarashda ajratadi.
 */
function WordRow({ word, index }: { word: LessonWord; index: number }) {
  const { article, rest } = splitArticle(word.de);
  const tone = article ? ARTICLE[article] : null;

  return (
    <li className="grid grid-cols-[1fr_1fr] items-start gap-3 border-b border-white/45 px-4 py-3 last:border-0">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="w-4 shrink-0 text-[11.5px] font-bold tabular-nums text-slate-400">{index}</span>
        <span className="min-w-0 break-words text-[15px] font-extrabold leading-snug" style={{ color: NAVY }}>
          {tone && <span style={{ color: tone.fg }}>{article} </span>}
          {rest}
        </span>
      </span>

      <span className="break-words text-[14.5px] leading-snug text-slate-600">{word.uz ?? "—"}</span>
    </li>
  );
}
