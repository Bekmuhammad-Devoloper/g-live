"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { createKanbanColumn, enrollOptions, pinKanbanGroup, type EnrollGroupOpt } from "../actions";
import { GROUP_COL_COLORS, GROUP_COL_ICONS, type CustomColumn, type GroupColumn } from "../_lib/leadColumns";

// Yonboshdan ochiladigan "qo'shish" paneli. Ikki joydan chaqiriladi:
//
//   variant="main" — sarlavhadagi "+ Yangi lid" tugmasi. Uch yo'l:
//     1) Guruhga yo'naltirilgan ustun — guruh Kanbanda alohida ustun bo'ladi,
//        lid tashlansa o'sha guruhga yoziladi;
//     2) Oddiy nomli ustun — istalgan nom bilan ("Sentyabr oqimi", "VIP"),
//        lid tashlansa shu ustunga o'tadi, bosqichi o'zgarmaydi;
//     3) Yangi lid — oddiy lid formasi.
//
//   variant="won" — "Qabul qilindi" ustunidagi "+". Guruh biriktirish yoki
//     yangi o'quvchi (guruh majburiy).

interface Props {
  locale: Locale;
  open: boolean;
  variant?: "won" | "main";
  /** Allaqachon biriktirilgan guruhlar — ro'yxatda belgilanadi */
  pinned: GroupColumn[];
  /** Mavjud oddiy ustunlar — takror nom tekshiruvi va ro'yxat uchun */
  customColumns?: CustomColumn[];
  onClose: () => void;
  onNewLead: () => void;
  onPinned: (columns: GroupColumn[]) => void;
  onColumnCreated?: (columns: CustomColumn[]) => void;
}

type Mode = "choose" | "group" | "custom";

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export default function WonAddDrawer({
  locale, open, variant = "won", pinned, customColumns = [], onClose, onNewLead, onPinned, onColumnCreated,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");
  const [groups, setGroups] = useState<EnrollGroupOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(GROUP_COL_COLORS[0]);
  const [icon, setIcon] = useState(GROUP_COL_ICONS[0]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  useEffect(() => setMounted(true), []);

  // Guruhlar ro'yxati faqat "Guruh biriktirish" bosilganda kerak bo'ladi
  useEffect(() => {
    if (mode !== "group" || groups.length > 0) return;
    let alive = true;
    setLoading(true);
    enrollOptions()
      .then((o) => { if (alive) setGroups(o.groups); })
      .catch(() => { if (alive) setErr(L("Guruhlarni yuklab bo'lmadi", "Не удалось загрузить группы", "Could not load groups", "Gruppen konnten nicht geladen werden")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.groupId)), [pinned]);

  const shown = useMemo(() => {
    const needle = norm(q);
    if (!needle) return groups;
    return groups.filter((g) => norm(g.name).includes(needle) || norm(g.courseName).includes(needle));
  }, [groups, q]);

  const nameTaken = useMemo(() => {
    const n = norm(name);
    return !!n && customColumns.some((c) => norm(c.name) === n);
  }, [name, customColumns]);

  if (!mounted || !open) return null;

  function close() {
    setMode("choose");
    setQ("");
    setPicked(null);
    setName("");
    setErr(null);
    onClose();
  }

  function back() {
    setMode("choose");
    setPicked(null);
    setName("");
    setErr(null);
  }

  function submitGroup() {
    if (!picked) return;
    setErr(null);
    start(async () => {
      const r = await pinKanbanGroup(picked, color, icon);
      if (r.error || !r.columns) {
        setErr(L("Saqlab bo'lmadi", "Не удалось сохранить", "Could not save", "Konnte nicht gespeichert werden"));
        return;
      }
      onPinned(r.columns);
      close();
    });
  }

  function submitCustom() {
    const clean = name.replace(/\s+/g, " ").trim();
    if (clean.length < 2 || nameTaken) return;
    setErr(null);
    start(async () => {
      const r = await createKanbanColumn(clean, color, icon);
      if (r.error || !r.columns) {
        setErr(
          r.error === "duplicate"
            ? L("Bunday nomli ustun bor", "Столбец с таким именем уже есть", "A column with this name exists", "Spalte mit diesem Namen existiert")
            : r.error === "limit"
              ? L("Ustunlar soni chegarasiga yetdi", "Достигнут лимит столбцов", "Column limit reached", "Spaltenlimit erreicht")
              : L("Saqlab bo'lmadi", "Не удалось сохранить", "Could not save", "Konnte nicht gespeichert werden"),
        );
        return;
      }
      onColumnCreated?.(r.columns);
      close();
    });
  }

  const pickedGroup = groups.find((g) => g.id === picked) ?? null;
  const isMain = variant === "main";

  const title =
    mode === "group"
      ? L("Guruhga yo'naltirilgan ustun", "Столбец для группы", "Group column", "Gruppenspalte")
      : mode === "custom"
        ? L("Oddiy nomli ustun", "Столбец с названием", "Named column", "Benannte Spalte")
        : isMain
          ? L("Qo'shish", "Добавить", "Add", "Hinzufügen")
          : L("Qabul qilindi", "Принят", "Won", "Aufgenommen");

  const subtitle =
    mode === "group"
      ? L("Guruh Kanbanda alohida ustun bo'ladi", "Группа станет отдельным столбцом", "The group becomes its own column", "Die Gruppe wird eine eigene Spalte")
      : mode === "custom"
        ? L("Nom, rang va belgi tanlang", "Введите название, цвет и значок", "Choose a name, colour and icon", "Name, Farbe und Symbol wählen")
        : isMain
          ? L("Nimani qo'shamiz?", "Что добавляем?", "What do we add?", "Was fügen wir hinzu?")
          : L("Qanday qo'shamiz?", "Как добавляем?", "How do we add?", "Wie hinzufügen?");

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={close}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[420px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        {/* ── Sarlavha ── */}
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3.5 dark:border-white/10">
          {mode !== "choose" ? (
            <button
              type="button"
              onClick={back}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
              aria-label={L("Orqaga", "Назад", "Back", "Zurück")}
            >
              <Icon name="arrow" className="h-4 w-4 rotate-180" />
            </button>
          ) : isMain ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600">
              <Icon name="plus" className="h-4 w-4" strokeWidth={3} />
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <Icon name="check" className="h-4 w-4" strokeWidth={3} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="truncate text-xs text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
            aria-label={L("Yopish", "Закрыть", "Close", "Schließen")}
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {/* ── Tanlov ── */}
        {mode === "choose" && (
          <div className="space-y-2.5 p-4">
            <Choice
              icon="layers"
              tone="brand"
              title={isMain
                ? L("Guruhga yo'naltirilgan ustun", "Столбец для группы", "Group column", "Gruppenspalte")
                : L("Guruh biriktirish", "Привязать группу", "Assign a group", "Gruppe zuweisen")}
              text={L(
                "Guruh alohida ustun bo'ladi — lidni tashlasangiz o'sha guruhga yoziladi",
                "Группа станет столбцом — перетащите лид, и он попадёт в неё",
                "The group becomes a column — drop a lead to enrol it there",
                "Die Gruppe wird eine Spalte — Lead hineinziehen zum Einschreiben",
              )}
              onClick={() => setMode("group")}
            />

            {isMain && (
              <Choice
                icon="layout"
                tone="violet"
                title={L("Oddiy nomli ustun", "Столбец с названием", "Named column", "Benannte Spalte")}
                text={L(
                  "O'zingiz nom berasiz — lidlarni shu ustunga yig'asiz, bosqichi o'zgarmaydi",
                  "Название задаёте сами — собирайте в него лиды, этап не меняется",
                  "You name it — collect leads there, their stage stays the same",
                  "Sie benennen sie — Leads dort sammeln, die Phase bleibt gleich",
                )}
                onClick={() => setMode("custom")}
              />
            )}

            <Choice
              icon="personPlus"
              tone="emerald"
              title={isMain
                ? L("Yangi lid qo'shish", "Добавить новый лид", "Add a new lead", "Neuen Lead hinzufügen")
                : L("Yangi o'quvchi qo'shish", "Добавить нового ученика", "Add a new student", "Neuen Schüler hinzufügen")}
              text={isMain
                ? L("Ism, telefon, manba — oddiy lid formasi", "Имя, телефон, источник — обычная форма лида", "Name, phone, source — the usual lead form", "Name, Telefon, Quelle — das übliche Lead-Formular")
                : L("Yangi yozuv — guruh tanlash majburiy", "Новая запись — группа обязательна", "A new record — a group is required", "Neuer Eintrag — Gruppe erforderlich")}
              onClick={() => { onNewLead(); close(); }}
            />

            {(pinned.length > 0 || (isMain && customColumns.length > 0)) && (
              <div className="pt-2">
                <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {L("Mavjud ustunlar", "Существующие столбцы", "Existing columns", "Vorhandene Spalten")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {isMain && customColumns.map((c) => (
                    <span key={c.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold" style={{ color: c.color, background: `${c.color}1f` }}>
                      <Icon name={c.icon} className="h-3.5 w-3.5" />
                      {c.name}
                    </span>
                  ))}
                  {pinned.map((p) => (
                    <span key={p.groupId} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold" style={{ color: p.color, background: `${p.color}1f` }}>
                      <Icon name={p.icon} className="h-3.5 w-3.5" />
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Guruh ro'yxati ── */}
        {mode === "group" && (
          <>
            <div className="border-b border-slate-200 p-3 dark:border-white/10">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                placeholder={L("Guruh yoki kurs nomi", "Название группы или курса", "Group or course name", "Gruppen- oder Kursname")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <p className="py-10 text-center text-sm text-slate-400">{L("Yuklanmoqda…", "Загрузка…", "Loading…", "Lädt…")}</p>
              ) : shown.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  {L("Guruh topilmadi", "Группа не найдена", "No group found", "Keine Gruppe gefunden")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {shown.map((g) => {
                    const already = pinnedIds.has(g.id);
                    const active = picked === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setPicked(g.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
                          active
                            ? "border-brand-500 bg-brand-50/70 dark:bg-white/[0.06]"
                            : "border-slate-200 hover:border-brand-300 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.04]",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{g.name}</span>
                          <span className="block truncate text-[11.5px] text-slate-400">
                            {g.courseName}
                            {g.schedule ? ` · ${g.schedule}` : ""}
                          </span>
                        </span>
                        {already && (
                          <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-600">
                            {L("ustunda", "в столбце", "pinned", "angeheftet")}
                          </span>
                        )}
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">
                          {g.taken}/{g.capacity}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <StylePicker
              locale={locale}
              color={color} onColor={setColor}
              icon={icon} onIcon={setIcon}
              previewName={pickedGroup?.name ?? null}
              err={err}
              disabled={!picked || saving}
              saving={saving}
              submitLabel={L("Kanbanga biriktirish", "Привязать к канбану", "Add to the board", "Zum Board hinzufügen")}
              onSubmit={submitGroup}
            />
          </>
        )}

        {/* ── Oddiy nomli ustun ── */}
        {mode === "custom" && (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {L("Ustun nomi", "Название столбца", "Column name", "Spaltenname")}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitCustom(); }}
                autoFocus
                maxLength={40}
                placeholder={L("Masalan: Sentyabr oqimi, VIP, Qayta aloqa", "Например: Сентябрьский поток, VIP", "e.g. September intake, VIP", "z.B. September-Kurs, VIP")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {nameTaken ? (
                <p className="mt-1.5 text-xs font-medium text-red-500">
                  {L("Bunday nomli ustun allaqachon bor", "Столбец с таким именем уже есть", "A column with this name already exists", "Spalte mit diesem Namen existiert bereits")}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">
                  {L(
                    "Ustun \"Test / Taklif\" dan keyin chiqadi. Lid unga tashlansa bosqichi o'zgarmaydi; standart ustunga qaytarilsa ustundan chiqadi.",
                    "Столбец появится после «Тест / Предложение». Этап лида при переносе не меняется; при возврате в обычный столбец он покидает этот.",
                    "The column appears after \"Test / Offer\". Dropping a lead keeps its stage; moving it back to a standard column removes it from here.",
                    "Die Spalte erscheint nach \"Test / Angebot\". Der Lead behält seine Phase; beim Zurückschieben verlässt er die Spalte.",
                  )}
                </p>
              )}
            </div>

            <StylePicker
              locale={locale}
              color={color} onColor={setColor}
              icon={icon} onIcon={setIcon}
              previewName={name.trim() || null}
              err={err}
              disabled={name.trim().length < 2 || nameTaken || saving}
              saving={saving}
              submitLabel={L("Ustun yaratish", "Создать столбец", "Create column", "Spalte erstellen")}
              onSubmit={submitCustom}
            />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─────────── Yordamchi qismlar ───────────

const TONE = {
  brand: { hover: "hover:border-brand-400 hover:bg-brand-50/60 dark:hover:border-brand-500", badge: "bg-brand-500/15 text-brand-600" },
  violet: { hover: "hover:border-violet-400 hover:bg-violet-50/60 dark:hover:border-violet-500", badge: "bg-violet-500/15 text-violet-600" },
  emerald: { hover: "hover:border-emerald-400 hover:bg-emerald-50/60 dark:hover:border-emerald-500", badge: "bg-emerald-500/15 text-emerald-600" },
} as const;

function Choice({ icon, tone, title, text, onClick }: { icon: string; tone: keyof typeof TONE; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition dark:border-white/10 dark:hover:bg-white/[0.04]",
        TONE[tone].hover,
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", TONE[tone].badge)}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{text}</span>
      </span>
    </button>
  );
}

function StylePicker({
  locale, color, onColor, icon, onIcon, previewName, err, disabled, saving, submitLabel, onSubmit,
}: {
  locale: Locale;
  color: string; onColor: (c: string) => void;
  icon: string; onIcon: (i: string) => void;
  previewName: string | null;
  err: string | null;
  disabled: boolean;
  saving: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  return (
    <div className="border-t border-slate-200 p-4 dark:border-white/10">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {L("Ustun rangi", "Цвет столбца", "Column colour", "Spaltenfarbe")}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {GROUP_COL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onColor(c)}
            aria-label={c}
            className={cn(
              "h-7 w-7 rounded-lg transition",
              color === c ? "ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-[#15243d]" : "hover:scale-110",
            )}
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {L("Ustun belgisi", "Значок столбца", "Column icon", "Spaltensymbol")}
      </div>
      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {GROUP_COL_ICONS.map((ic) => (
          <button
            key={ic}
            type="button"
            onClick={() => onIcon(ic)}
            aria-label={ic}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition",
              icon === ic ? "border-transparent" : "border-slate-200 text-slate-400 hover:text-slate-600 dark:border-white/10",
            )}
            style={icon === ic ? { color, background: `${color}22` } : undefined}
          >
            <Icon name={ic} className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* Ko'rinishi — ustun sarlavhasi aynan shunday bo'ladi */}
      {previewName && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-white/[0.04]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color, background: `${color}1f` }}>
            <Icon name={icon} className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-100">{previewName}</span>
        </div>
      )}

      {err && <p className="mb-2 text-xs font-medium text-red-500">{err}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "…" : submitLabel}
      </button>
    </div>
  );
}
