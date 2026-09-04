import MissingStudent from "../../../../MissingStudent";
import { loadUnit } from "../_load";
import { SectionHeader, IcoWords } from "../_parts";
import { looksLikeVocabulary, parseLessonWords } from "@/lib/lessonWords";

// Darsning lug'ati.
//
// So'zlar yangi ma'lumot emas: o'qituvchi darsning mavzu maydoniga
// "der Hund - it, die Katze - mushuk" ko'rinishida yozadi. Ajratish mantig'i
// lib/lessonWords.ts da — lug'at sahifasi ham aynan shu manbadan oladi.

const ACCENT = "linear-gradient(150deg, #f6c453 0%, #e09217 100%)";

export default async function LessonVocabPage({
  params,
}: {
  params: Promise<{ level: string; unit: string }>;
}) {
  const { level, unit } = await params;
  const ctx = await loadUnit(level, unit);
  if (ctx.missing) return <MissingStudent />;

  const { t, code, lesson, unitLabel } = ctx;
  const words = parseLessonWords(lesson.topic);
  const hasVocab = words.length > 0 && looksLikeVocabulary(words);

  return (
    <div>
      <SectionHeader
        backHref={`/student/kurse/${code}/${lesson.id}`}
        backLabel={t.back}
        title={t.vocabulary}
        subtitle={`${unitLabel} · ${lesson.title}`}
        accent={ACCENT}
      />

      {hasVocab ? (
        <section className="gl-glass mt-4 overflow-hidden rounded-[26px]">
          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-white" style={{ background: ACCENT }}>
              <IcoWords s={21} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-slate-900">{t.vocabulary}</span>
            <span className="shrink-0 rounded-full bg-white/60 px-2.5 py-[4px] text-[12px] font-bold text-slate-700">
              {words.length} {t.wordCount}
            </span>
          </div>

          {/* Ikki ustun: nemischa | tarjimasi */}
          <ul className="border-t border-white/50">
            {words.map((w, i) => (
              <li key={w.de} className="grid grid-cols-[1fr_1fr] items-start gap-3 border-b border-white/40 px-4 py-3 last:border-0">
                <span className="flex min-w-0 gap-2">
                  <span className="w-5 shrink-0 pt-[2px] text-[11.5px] font-bold text-slate-500">{i + 1}</span>
                  <span className="min-w-0 break-words text-[15px] font-bold leading-snug text-slate-900">{w.de}</span>
                </span>
                <span className="break-words text-[14.5px] leading-snug text-slate-600">{w.uz ?? "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
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
