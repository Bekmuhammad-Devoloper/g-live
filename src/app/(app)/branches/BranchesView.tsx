"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { exportRows } from "@/lib/export";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import MapPicker from "./MapPicker";
import { saveBranch, deleteBranch } from "./actions";

export interface VBranch { id: string; name: string; address: string; phone: string; lat: number | null; lng: number | null; radius: number; imageUrl: string | null; staff: number; groups: number }

export default function BranchesView({ branches, canManage, locale }: { branches: VBranch[]; canManage: boolean; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<VBranch | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? branches.filter((b) => `${b.name} ${b.address}`.toLowerCase().includes(q)) : branches;
  }, [branches, search]);

  const del = (id: string) => { if (confirm(tr(locale, { uz: "Filialni o'chirasizmi?", ru: "Удалить филиал?", en: "Delete this branch?", de: "Filiale löschen?" }))) start(async () => { await deleteBranch(id); router.refresh(); }); };

  const exportCsvNow = () => exportRows(
    tr(locale, { uz: "filiallar", ru: "филиалы", en: "branches", de: "Filialen" }),
    [
      { key: "name", label: tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" }) },
      { key: "address", label: tr(locale, { uz: "Manzil", ru: "Адрес", en: "Address", de: "Adresse" }) },
      { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" }) },
      { key: "radius", label: tr(locale, { uz: "Radius (m)", ru: "Радиус (м)", en: "Radius (m)", de: "Radius (m)" }) },
      { key: "location", label: tr(locale, { uz: "Joylashuv", ru: "Локация", en: "Location", de: "Standort" }) },
      { key: "staff", label: tr(locale, { uz: "Xodimlar", ru: "Сотрудники", en: "Staff", de: "Mitarbeiter" }) },
      { key: "groups", label: tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" }) },
    ],
    filtered.map((b) => ({
      name: b.name,
      address: b.address,
      phone: b.phone,
      radius: b.radius,
      location: b.lat != null && b.lng != null ? `${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}` : "",
      staff: b.staff,
      groups: b.groups,
    })),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Filiallar", ru: "Филиалы", en: "Branches", de: "Filialen" })}</h1>

      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <button onClick={() => { setEditing(null); setOpen(true); }} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Filial qo'shish", ru: "Добавить филиал", en: "Add branch", de: "Filiale hinzufügen" })}
          </button>
        )}
        <div className="relative ml-auto">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search", de: "Suche" })} className="h-10 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <button onClick={exportCsvNow} className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60" title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV", de: "CSV herunterladen" })}>
          <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export", de: "Export" })}
        </button>
      </div>

      <div className={cn("overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900", pending && "opacity-70")}>
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni", ru: "Всего", en: "Total", de: "Gesamtzahl" })}: {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th><th className="px-4 py-3">{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Manzil", ru: "Адрес", en: "Address", de: "Adresse" })}</th>
                <th className="px-4 py-3 text-center">{tr(locale, { uz: "Radius (m)", ru: "Радиус (м)", en: "Radius (m)", de: "Radius (m)" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Joylashuv", ru: "Локация", en: "Location", de: "Standort" })}</th>
                <th className="px-4 py-3 text-center">{tr(locale, { uz: "Xodimlar", ru: "Сотрудники", en: "Staff", de: "Mitarbeiter" })}</th><th className="px-4 py-3 text-center">{tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })}</th>
                {canManage && <th className="px-4 py-3 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" })}</td></tr>
              ) : filtered.map((b, i) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {b.imageUrl ? (
                        <span className="h-8 w-8 shrink-0 rounded-full bg-cover bg-center ring-1 ring-slate-200 dark:ring-white/10" style={{ backgroundImage: `url(${b.imageUrl})` }} />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><Icon name="building" className="h-4 w-4" /></span>
                      )}
                      <span className="font-medium text-slate-800 dark:text-slate-100">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{b.address || "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{b.radius}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{b.lat != null && b.lng != null ? `${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}` : "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{b.staff}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{b.groups}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button onClick={() => { setEditing(b); setOpen(true); }} className="transition hover:text-brand-600" title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit", de: "Bearbeiten" })}><Icon name="pencil" className="h-4 w-4" /></button>
                        <button onClick={() => del(b.id)} className="transition hover:text-rose-600" title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}><Icon name="trash" className="h-4 w-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && canManage && <BranchForm editing={editing} locale={locale} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); router.refresh(); }} />}
    </div>
  );
}

function BranchForm({ editing, onClose, onSaved, locale }: { editing: VBranch | null; onClose: () => void; onSaved: () => void; locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [lat, setLat] = useState<number | null>(editing?.lat ?? null);
  const [lng, setLng] = useState<number | null>(editing?.lng ?? null);
  const [radius, setRadius] = useState<number>(editing?.radius ?? 100);
  const [image, setImage] = useState<string | null>(editing?.imageUrl ?? null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Galereyadan rasm tanlash — brauzerda kichraytirib (max 256px) data URL'ga aylantiramiz
  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) { ctx.drawImage(img, 0, 0, w, h); setImage(canvas.toDataURL("image/jpeg", 0.82)); }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;

  const inp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
  const lbl = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

  const submit = () => {
    setError(null);
    const fd = new FormData(formRef.current!);
    fd.set("lat", lat != null ? String(lat) : "");
    fd.set("lng", lng != null ? String(lng) : "");
    fd.set("radius", String(radius));
    fd.set("image", image ?? "");
    start(async () => { const r = await saveBranch(fd); if (r.ok) onSaved(); else setError(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error", de: "Fehler" })); });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form ref={formRef} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[620px] max-w-[96%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{editing ? tr(locale, { uz: "Filialni tahrirlash", ru: "Редактировать филиал", en: "Edit branch", de: "Filiale bearbeiten" }) : tr(locale, { uz: "Filial qo'shish", ru: "Добавить филиал", en: "Add branch", de: "Filiale hinzufügen" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200 transition hover:ring-2 hover:ring-brand-400 dark:bg-slate-800 dark:ring-white/10"
              title={tr(locale, { uz: "Galereyadan rasm tanlash", ru: "Выбрать фото из галереи", en: "Choose image from gallery", de: "Bild aus der Galerie wählen" })}
            >
              {image ? (
                <span className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
              ) : (
                <Icon name="building" className="h-9 w-9" />
              )}
              <span className="absolute inset-0 hidden place-items-center bg-slate-900/45 text-white group-hover:grid">
                <Icon name="camera" className="h-6 w-6" />
              </span>
            </button>
            <span className="text-[11px] text-slate-400">{image ? tr(locale, { uz: "Rasmni almashtirish", ru: "Заменить фото", en: "Replace image", de: "Bild ersetzen" }) : tr(locale, { uz: "Rasm yuklash", ru: "Загрузить фото", en: "Upload image", de: "Bild hochladen" })}</span>
            {image && (
              <button type="button" onClick={() => setImage(null)} className="text-[11px] text-rose-500 hover:underline">
                {tr(locale, { uz: "Rasmni o'chirish", ru: "Удалить фото", en: "Remove image", de: "Bild entfernen" })}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          </div>
          <div><label className={lbl}>{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })} <span className="text-rose-500">*</span></label><input name="name" required defaultValue={editing?.name ?? ""} placeholder={tr(locale, { uz: "Filial nomi", ru: "Название филиала", en: "Branch name", de: "Name der Filiale" })} className={inp} /></div>
          <div><label className={lbl}>{tr(locale, { uz: "Manzil", ru: "Адрес", en: "Address", de: "Adresse" })}</label><input name="address" defaultValue={editing?.address ?? ""} placeholder={tr(locale, { uz: "Manzil", ru: "Адрес", en: "Address", de: "Adresse" })} className={inp} /></div>
          <div><label className={lbl}>{tr(locale, { uz: "Radius (metr)", ru: "Радиус (метр)", en: "Radius (meters)", de: "Radius (Meter)" })} <span className="text-rose-500">*</span></label><input type="number" min="1" value={radius} onChange={(e) => setRadius(Math.max(1, Number(e.target.value) || 100))} className={inp} /></div>

          <div>
            <label className={lbl}>{tr(locale, { uz: "Manzil — xaritadan tanlash", ru: "Адрес — выбрать на карте", en: "Address — pick on map", de: "Adresse — auf der Karte auswählen" })}</label>
            <MapPicker lat={lat} lng={lng} radius={radius} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
            <p className="mt-1 text-[11px] text-slate-400">{tr(locale, { uz: "Markerni suring yoki xaritaga bosing.", ru: "Перетащите маркер или нажмите на карту.", en: "Drag the marker or click on the map.", de: "Ziehen Sie den Marker oder klicken Sie auf die Karte." })}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>{tr(locale, { uz: "Manzil (Lat)", ru: "Координата (Lat)", en: "Coordinate (Lat)", de: "Koordinate (Lat)" })}</label><input value={lat != null ? lat.toFixed(8) : ""} readOnly placeholder="—" className={cn(inp, "bg-slate-50 dark:bg-slate-800/40")} /></div>
            <div><label className={lbl}>{tr(locale, { uz: "Manzil (Lng)", ru: "Координата (Lng)", en: "Coordinate (Lng)", de: "Koordinate (Lng)" })}</label><input value={lng != null ? lng.toFixed(8) : ""} readOnly placeholder="—" className={cn(inp, "bg-slate-50 dark:bg-slate-800/40")} /></div>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">{tr(locale, { uz: "Orqaga", ru: "Назад", en: "Back", de: "Zurück" })}</button>
          <button type="button" onClick={submit} disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
        </div>
      </form>
    </div>, document.body);
}
