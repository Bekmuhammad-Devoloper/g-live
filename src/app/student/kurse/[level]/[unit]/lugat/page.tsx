import MissingStudent from "../../../../MissingStudent";
import { loadUnit } from "../_load";
import { SectionHeader, IcoWords, Attachment } from "../_parts";
import { lessonVocabText, looksLikeVocabulary, parseLessonWords } from "@/lib/lessonWords";
import { loadUnitProgress } from "../_progress";
import { NAVY, TEAL } from "../../../../_ui";

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
  const words = parseLessonWords(lessonVocabText(lesson));
  const hasVocab = words.length > 0 && looksLikeVocabulary(words);
  const p = await loadUnitProgress(ctx);

  return (
    <div>
      <SectionHeader
        backHref={`/student/kurse/${code}/${lesson.id}`}
        backLabel={t.back}
        title={t.vocabulary}
        subtitle={`${unitLabel} · ${lesson.title}`}
        accent={ACCENT}
      />

      {/* O'rganilgan ulushi — dars sahifasidagi karta bilan bir xil manba,
          shu sabab ikki joyda ikki xil raqam chiqmaydi. */}
      {hasVocab && (
        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(19,78,94,0.12)]">
            <div className="h-full rounded-full" style={{ width: `${p.vocab.pct}%`, background: `linear-gradient(90deg,#f6c453,#e09217)` }} />
          </div>
          <span className="text-[13px] font-extrabold tabular-nums" style={{ color: NAVY }}>
            {p.vocab.pct}%
          </span>
        </div>
      )}

      {/* Ustoz yuklagan lug'at fayli (pdf/word/txt). So'zlar ro'yxatiga
          QO'SHIMCHA — ikkalasi ham bo'lishi mumkin, birortasi ham. */}
      {lesson.vocabFileUrl && (
        <section className="gl-glass mt-4 rounded-[26px] px-4 pb-4 pt-3.5">
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
