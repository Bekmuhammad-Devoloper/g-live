"use client";

import { useEffect, useState, useTransition } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../../_components/Icon";
import { getLevelTestQr, setLevelTestUrl, type LevelTestQr } from "../../actions";

/**
 * "Daraja testi" ustunidagi QR oynasi.
 * Lid telefonida skan qiladi → alohida saytdagi daraja aniqlash testiga o'tadi.
 * Havola bo'lmasa (yoki o'zgartirish kerak bo'lsa) rahbariyat shu yerning o'zida kiritadi.
 */
export default function LevelTestQrModal({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<LevelTestQr | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    setData(null); setEditing(false); setErr(null); setCopied(false);
    getLevelTestQr().then((r) => {
      setData(r);
      setDraft(r.url ?? "");
      // Havola hali yo'q va foydalanuvchi kirita oladi — darhol kiritish maydoni
      if (!r.url && r.canEdit) setEditing(true);
    });
  }, [open]);

  if (!open) return null;

  const errText = (code: string) =>
    code === "invalid_url"
      ? tr(locale, { uz: "Havola http:// yoki https:// bilan boshlanishi kerak", ru: "Ссылка должна начинаться с http:// или https://", en: "The link must start with http:// or https://", de: "Der Link muss mit http:// oder https:// beginnen" })
      : code === "forbidden"
        ? tr(locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "Not allowed", de: "Keine Berechtigung" })
        : tr(locale, { uz: "QR yaratib bo'lmadi", ru: "Не удалось создать QR", en: "Failed to generate QR", de: "QR-Code konnte nicht erstellt werden" });

  const save = () => {
    setErr(null);
    start(async () => {
      const r = await setLevelTestUrl(draft);
      if (r.error) { setErr(errText(r.error)); return; }
      setData(r);
      setDraft(r.url ?? "");
      setEditing(false);
    });
  };

  const copy = async () => {
    if (!data?.url) return;
    try { await navigator.clipboard.writeText(data.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600">
            <Icon name="qr" className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Daraja testi", ru: "Тест уровня", en: "Level test", de: "Einstufungstest" })}</h3>
            <p className="text-xs text-slate-400">{tr(locale, { uz: "Lid telefonida skan qiladi — test saytiga o'tadi", ru: "Лид сканирует телефоном — переходит на сайт теста", en: "The lead scans it and lands on the test site", de: "Der Lead scannt und gelangt zur Test-Seite" })}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {!data ? (
          <div className="grid h-56 place-items-center text-sm text-slate-400">{tr(locale, { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Loading...", de: "Wird geladen..." })}</div>
        ) : editing ? (
          // Havolani kiritish / o'zgartirish
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Test sayti havolasi", ru: "Ссылка на сайт теста", en: "Test site link", de: "Link zur Test-Seite" })}</label>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              autoFocus
              inputMode="url"
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {err && <p className="mt-1.5 text-xs text-rose-500">{err}</p>}
            <p className="mt-1.5 text-[11px] text-slate-400">{tr(locale, { uz: "Bo'sh qoldirib saqlansa — havola olib tashlanadi", ru: "Сохраните пустым — ссылка будет удалена", en: "Save empty to remove the link", de: "Leer speichern entfernt den Link" })}</p>
            <div className="mt-4 flex justify-end gap-2">
              {data.url && <button onClick={() => { setEditing(false); setDraft(data.url ?? ""); setErr(null); }} className="btn-ghost">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>}
              <button onClick={save} disabled={pending} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50">
                {pending ? "..." : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
              </button>
            </div>
          </div>
        ) : !data.url ? (
          // Havola yo'q va foydalanuvchi kirita olmaydi
          <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center dark:border-slate-600">
            <div className="text-3xl opacity-40">🔗</div>
            <p className="mt-2 px-4 text-sm text-slate-500">{tr(locale, { uz: "Test sayti havolasi hali sozlanmagan. Uni direktor yoki administrator kiritadi.", ru: "Ссылка на сайт теста ещё не настроена. Её добавит директор или администратор.", en: "The test site link is not set yet. A director or administrator can add it.", de: "Der Link zur Test-Seite ist noch nicht eingerichtet. Direktor oder Administrator können ihn hinzufügen." })}</p>
          </div>
        ) : (
          <div className="text-center">
            {data.qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.qr} alt="QR" className="mx-auto h-56 w-56 rounded-lg bg-white" />
            ) : (
              <p className="py-8 text-sm text-rose-500">{errText("qr_failed")}</p>
            )}
            <p className="mt-2 break-all font-mono text-[11px] text-slate-400">{data.url}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {data.qr && (
                <a href={data.qr} download="daraja-testi-qr.png" className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700">
                  <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "PNG yuklab olish", ru: "Скачать PNG", en: "Download PNG", de: "PNG herunterladen" })}
                </a>
              )}
              <button onClick={copy} className="btn-ghost">
                <Icon name="copy" className="h-4 w-4" /> {copied ? tr(locale, { uz: "Nusxalandi", ru: "Скопировано", en: "Copied", de: "Kopiert" }) : tr(locale, { uz: "Havolani nusxalash", ru: "Копировать ссылку", en: "Copy link", de: "Link kopieren" })}
              </button>
              {data.canEdit && (
                <button onClick={() => { setEditing(true); setErr(null); }} className="btn-ghost">
                  <Icon name="edit" className="h-4 w-4" /> {tr(locale, { uz: "O'zgartirish", ru: "Изменить", en: "Change", de: "Ändern" })}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
