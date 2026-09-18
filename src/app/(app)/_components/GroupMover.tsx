"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";

export interface GroupOpt {
  id: string;
  name: string;
  /** Kurs nomi */
  program: string | null;
  level: string | null;
  students: number;
  capacity: number;
  /** "Du, Chor, Ju · 18:00–19:30" — bo'lmasa null */
  schedule: string | null;
  teacher: string | null;
}

/**
 * O'quvchini bir guruhdan boshqasiga ko'chirish (tahrirlash oynasi ichida).
 * Guruhlar ro'yxati faqat blok ochilganda yuklanadi; hozirgi guruh(lar)
 * ro'yxatdan chiqarilgan. Eski guruhdagi a'zolik tugatiladi (leftAt), yangi
 * guruhga yoziladi — to'lov hisobi shu oydan yangi guruh bo'yicha yuritiladi.
 */
export default function GroupMover({
  locale,
  currentGroups,
  loadGroups,
  onMove,
}: {
  locale: Locale;
  /** Hozirgi faol guruhlar */
  currentGroups: { id: string; name: string }[];
  loadGroups: () => Promise<GroupOpt[]>;
  onMove: (fromGroupId: string | null, toGroupId: string) => Promise<{ ok?: boolean; error?: string; groupName?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<GroupOpt[] | null>(null);
  const [from, setFrom] = useState<string>(currentGroups[0]?.id ?? "");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  useEffect(() => {
    if (!open || groups) return;
    loadGroups().then(setGroups).catch(() => setErr(L("Guruhlarni yuklab bo'lmadi", "Не удалось загрузить группы", "Could not load groups", "Gruppen konnten nicht geladen werden")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentIds = new Set(currentGroups.map((g) => g.id));
  const options = (groups ?? []).filter((g) => !currentIds.has(g.id));
  const target = options.find((g) => g.id === to) ?? null;
  const full = !!target && target.students >= target.capacity;

  const move = () => {
    if (!to) return;
    setErr(null);
    start(async () => {
      const r = await onMove(from || null, to);
      if (r.ok) {
        setMsg(L(`Ko'chirildi: ${r.groupName ?? ""}`, `Переведён: ${r.groupName ?? ""}`, `Moved to ${r.groupName ?? ""}`, `Verschoben: ${r.groupName ?? ""}`));
        setOpen(false);
        setTo("");
        router.refresh();
      } else {
        setErr(
          r.error === "forbidden"
            ? L("Sizda bu amal uchun ruxsat yo'q.", "У вас нет прав на это действие.", "You do not have permission for this action.", "Keine Berechtigung für diese Aktion.")
            : r.error === "full"
              ? L("Guruh to'lgan — joy yo'q.", "Группа заполнена — мест нет.", "The group is full.", "Die Gruppe ist voll.")
              : L("Ko'chirib bo'lmadi.", "Не удалось перевести.", "Could not move.", "Konnte nicht verschoben werden."),
        );
      }
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <Icon name="layers" className="h-3.5 w-3.5" />
        {L("Guruh", "Группа", "Group", "Gruppe")}
      </div>
      {currentGroups.length === 0 ? (
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{L("guruhsiz", "без группы", "no group", "ohne Gruppe")}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {currentGroups.map((g) => (
            <span key={g.id} className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300">{g.name}</span>
          ))}
        </div>
      )}

      {msg && <p className="mt-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{msg}</p>}

      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="btn-ghost mt-2 w-full justify-start !py-1.5 text-xs">
          <Icon name="refresh" className="h-3.5 w-3.5" />
          {currentGroups.length
            ? L("Boshqa guruhga o'tkazish", "Перевести в другую группу", "Move to another group", "In andere Gruppe verschieben")
            : L("Guruhga biriktirish", "Добавить в группу", "Assign to a group", "Einer Gruppe zuordnen")}
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          {currentGroups.length > 1 && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">{L("Qaysi guruhdan", "Из какой группы", "From group", "Aus Gruppe")}</label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
              >
                {currentGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                <option value="">{L("— hech qaysidan chiqarmasdan (qo'shimcha guruh)", "— не выводить (дополнительная группа)", "— keep current (additional group)", "— keine verlassen (zusätzliche Gruppe)")}</option>
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">{L("Qaysi guruhga", "В какую группу", "To group", "In Gruppe")}</label>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={!groups || pending}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
            >
              <option value="">{groups ? L("— guruhni tanlang —", "— выберите группу —", "— pick a group —", "— Gruppe wählen —") : L("yuklanmoqda…", "загрузка…", "loading…", "wird geladen…")}</option>
              {options.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.level ? ` · ${g.level}` : ""} · {g.students}/{g.capacity}{g.students >= g.capacity ? ` · ${L("to'lgan", "полна", "full", "voll")}` : ""}
                </option>
              ))}
            </select>
          </div>
          {target && (
            <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11.5px] leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
              {[target.program, target.schedule, target.teacher].filter(Boolean).join(" · ") || "—"}
              {full && <span className="ml-1 font-semibold text-rose-600">· {L("to'lgan", "полна", "full", "voll")}</span>}
            </div>
          )}
          {from && (
            <p className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
              {L(
                "O'quvchi eski guruhdan chiqariladi (to'lov hisobi shu oydan yangi guruh bo'yicha).",
                "Ученик будет выведен из прежней группы (оплата с этого месяца — по новой группе).",
                "The student leaves the previous group (fees from this month follow the new group).",
                "Der Schüler verlässt die bisherige Gruppe (Gebühren ab diesem Monat nach der neuen Gruppe).",
              )}
            </p>
          )}
          {err && <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setErr(null); setTo(""); }}
              disabled={pending}
              className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              {L("Bekor", "Отмена", "Cancel", "Abbrechen")}
            </button>
            <button
              type="button"
              onClick={move}
              disabled={pending || !to || full}
              className="flex-[1.4] rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              {pending ? L("O'tkazilmoqda…", "Перевод…", "Moving…", "Wird verschoben…") : L("O'tkazish", "Перевести", "Move", "Verschieben")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
