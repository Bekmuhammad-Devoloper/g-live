"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { enrollOptions, enrollLeadToGroup, type EnrollGroupOpt } from "../actions";

// Lidni kurs + guruhga yo'naltirish paneli (yonboshdan ochiladi).
// "Qabul qilindi" bosqichiga o'tish uchun MAJBURIY qadam.
// Guruh keyin faqat BIR MARTA o'zgartirilishi mumkin — shuning uchun
// tasdiqlashdan oldin ogohlantirish ko'rsatiladi.

interface Props {
  locale: Locale;
  open: boolean;
  leadId: string;
  leadName: string;
  /** Hozirgi guruh (o'zgartirish rejimida) */
  currentGroupId?: string | null;
  /** Necha marta o'zgartirilgan (0 = hali o'zgartirilmagan) */
  editCount?: number;
  onClose: () => void;
  onDone: (msg: string) => void;
}

export default function EnrollDrawer({
  locale, open, leadId, leadName, currentGroupId, editCount = 0, onClose, onDone,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<EnrollGroupOpt[]>([]);
  const [course, setCourse] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const loadedRef = useRef(false);

  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });
  const isChange = Boolean(currentGroupId);
  const editsLeft = Math.max(0, 1 - editCount);

  useEffect(() => setMounted(true), []);

  // Ma'lumotni faqat panel ochilganda yuklaymiz
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    enrollOptions()
      .then((o) => { setCourses(o.courses); setGroups(o.groups); })
      .catch(() => setErr(L("Ro'yxatni yuklab bo'lmadi", "Не удалось загрузить список", "Could not load the list")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape bilan yopish + fon aylanishini to'xtatish
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups.filter((g) => {
      if (course && g.courseId !== course) return false;
      if (g.id === currentGroupId) return false;              // hozirgi guruh qayta taklif qilinmaydi
      if (!needle) return true;
      return `${g.name} ${g.courseName} ${g.teacher ?? ""} ${g.room ?? ""}`.toLowerCase().includes(needle);
    });
  }, [groups, course, q, currentGroupId]);

  const submit = useCallback(() => {
    if (!picked) return;
    setErr(null);
    start(async () => {
      const r = await enrollLeadToGroup(leadId, picked);
      if (r.ok) {
        onDone(
          isChange
            ? L(`Guruh o'zgartirildi: ${r.groupName}`, `Группа изменена: ${r.groupName}`, `Group changed: ${r.groupName}`)
            : L(`${leadName} — ${r.groupName} guruhiga qabul qilindi`, `${leadName} принят(а) в группу ${r.groupName}`, `${leadName} enrolled in ${r.groupName}`)
        );
        return;
      }
      const M: Record<string, string> = {
        edit_limit: L("Guruhni o'zgartirish imkoni allaqachon ishlatilgan (faqat 1 marta)", "Возможность смены группы уже использована (только 1 раз)", "The one-time group change has already been used"),
        group_full: L("Bu guruh to'lgan — boshqasini tanlang", "Группа заполнена — выберите другую", "This group is full — pick another"),
        group_not_found: L("Guruh topilmadi", "Группа не найдена", "Group not found"),
        forbidden: L("Sizda ruxsat yo'q", "Нет доступа", "No permission"),
      };
      setErr(M[r.error ?? ""] ?? L("Amal bajarilmadi", "Не удалось выполнить", "Action failed"));
      setConfirming(false);
    });
  }, [picked, leadId, leadName, isChange, onDone, locale]);

  if (!mounted || !open) return null;

  const pickedGroup = groups.find((g) => g.id === picked) ?? null;
  const blocked = isChange && editsLeft === 0;

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[420px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        {/* Sarlavha */}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
              <Icon name="graduation" className="h-5 w-5 shrink-0 text-emerald-500" />
              {isChange ? L("Guruhni o'zgartirish", "Смена группы", "Change group") : L("Guruhga yo'naltirish", "Зачисление в группу", "Enroll in a group")}
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{leadName}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Ogohlantirish chizig'i */}
        <div className={cn(
          "shrink-0 px-5 py-2.5 text-[11px] leading-relaxed",
          blocked ? "bg-rose-500/10 text-rose-600 dark:text-rose-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        )}>
          {blocked
            ? L("Bu lid guruhi allaqachon bir marta o'zgartirilgan. Boshqa o'zgartirib bo'lmaydi.",
                "Группа этого лида уже менялась один раз. Больше изменить нельзя.",
                "This lead's group has already been changed once. No further changes are allowed.")
            : isChange
              ? L("Diqqat: guruhni faqat BIR MARTA o'zgartirish mumkin. Shundan keyin o'zgartirib bo'lmaydi.",
                  "Внимание: группу можно сменить только ОДИН РАЗ. После этого изменить нельзя.",
                  "Note: the group can be changed only ONCE. After that it is locked.")
              : L("Lidni \"Qabul qilindi\" qilish uchun guruh tanlash majburiy. Keyin faqat bir marta o'zgartira olasiz.",
                  "Для перевода лида в «Принят» выбор группы обязателен. Затем сменить можно только один раз.",
                  "Choosing a group is required to mark the lead as Won. Afterwards you may change it only once.")}
        </div>

        {/* Tanlov */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />)}
            </div>
          ) : blocked ? (
            <div className="rounded-xl border border-dashed border-rose-300 px-4 py-10 text-center text-sm text-rose-500 dark:border-rose-500/30">
              {L("O'zgartirish imkoni tugagan", "Возможность смены исчерпана", "No changes left")}
            </div>
          ) : (
            <>
              <label className="mb-3 block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {L("Kurs", "Курс", "Course")}
                </span>
                <select
                  value={course}
                  onChange={(e) => { setCourse(e.target.value); setPicked(null); }}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                >
                  <option value="">{L("Barcha kurslar", "Все курсы", "All courses")}</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              <div className="relative mb-3">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={L("Guruh, o'qituvchi, xona…", "Группа, преподаватель, кабинет…", "Group, teacher, room…")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                />
              </div>

              {shown.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-700">
                  {L("Mos guruh topilmadi", "Подходящих групп нет", "No matching groups")}
                </div>
              ) : (
                <div className="space-y-2">
                  {shown.map((g) => {
                    const full = g.taken >= g.capacity;
                    const on = picked === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={full}
                        onClick={() => setPicked(g.id)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition",
                          full && "cursor-not-allowed opacity-50",
                          on
                            ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-400/30 dark:border-emerald-500/50 dark:bg-emerald-500/10"
                            : "border-slate-200 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-white/5",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{g.name}</div>
                            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{g.courseName}</div>
                          </div>
                          <span className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            full ? "bg-rose-500/15 text-rose-600 dark:text-rose-300" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
                          )}>
                            {g.taken}/{g.capacity}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {g.teacher && <span className="flex items-center gap-1"><Icon name="user" className="h-3 w-3" />{g.teacher}</span>}
                          {g.schedule && <span className="flex items-center gap-1"><Icon name="clock" className="h-3 w-3" />{g.schedule}</span>}
                          {g.room && <span className="flex items-center gap-1"><Icon name="building" className="h-3 w-3" />{g.room}</span>}
                        </div>
                        {/* Guruh izohi (kament) */}
                        {g.note && (
                          <div className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                            <Icon name="info" className="mt-px h-3 w-3 shrink-0" />
                            <span className="line-clamp-2">{g.note}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {err && <div className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{err}</div>}
        </div>

        {/* Tasdiqlash */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          {confirming && pickedGroup ? (
            <>
              <p className="mb-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <b>{pickedGroup.name}</b> ({pickedGroup.courseName}) —{" "}
                {isChange
                  ? L("guruhni o'zgartirasizmi? Bu oxirgi imkoniyat.", "сменить группу? Это последняя возможность.", "change the group? This is the last chance.")
                  : L("lidni shu guruhga qabul qilasizmi?", "принять лида в эту группу?", "enroll the lead in this group?")}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirming(false)} disabled={pending}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                  {L("Orqaga", "Назад", "Back")}
                </button>
                <button type="button" onClick={submit} disabled={pending}
                  className="flex-[1.4] rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                  {pending ? L("Saqlanmoqda…", "Сохранение…", "Saving…") : L("Ha, tasdiqlayman", "Да, подтверждаю", "Yes, confirm")}
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                {L("Bekor qilish", "Отмена", "Cancel")}
              </button>
              <button
                type="button"
                disabled={!picked || blocked || pending}
                onClick={() => setConfirming(true)}
                className="flex-[1.4] rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
              >
                {isChange ? L("O'zgartirish", "Сменить", "Change") : L("Qabul qilish", "Принять", "Enroll")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
