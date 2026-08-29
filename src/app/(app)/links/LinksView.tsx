"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { exportRows } from "@/lib/export";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { platform, flagOf } from "./platforms";
import { toggleLink, deleteLink, deleteVacancy, regenerateCode } from "./actions";
import CreateLinkModal from "./CreateLinkModal";
import LinksTable from "./LinksTable";
import { DeleteConfirmModal, ResultLinksModal, QrModal } from "./LinkModals";
import type { CountryOption, CreatedLink, PlatformStat, Totals, VVacancy, VacancyOption } from "./types";

// Serverda ham, brauzerda ham bir xil natija beradigan raqam formati (hidratsiya xatosisiz).
const nf = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function LinksView({ locale, vacancies, totals, platformStats, countries, vacancyOptions, courseOptions, canManage, preselectVacancyId }: {
  locale: Locale;
  vacancies: VVacancy[];
  totals: Totals;
  platformStats: PlatformStat[];
  countries: CountryOption[];
  vacancyOptions: VacancyOption[];
  courseOptions: string[];
  canManage: boolean;
  preselectVacancyId: string | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [platFilter, setPlatFilter] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [create, setCreate] = useState<null | "new" | "existing">(preselectVacancyId ? "existing" : null);
  const [qr, setQr] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLink[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<null | { kind: "link" | "vacancy"; id: string; label: string }>(null);
  const [toast, setToast] = useState<null | { msg: string; type: "ok" | "err" }>(null);
  // Bo'sh origin bilan boshlaymiz — SSR va birinchi render mos keladi ("/apply/kod" nisbiy manzil ishlaydi).
  const [origin, setOrigin] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setCountryOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async (id: string, code: string) => {
    const url = `${origin}/apply/${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    setToast({ msg: tr(locale, { uz: "Havola nusxa olindi", ru: "Ссылка скопирована", en: "Link copied", de: "Link kopiert" }), type: "ok" });
  };

  const onToggle = (id: string) => start(async () => {
    await toggleLink(id);
    router.refresh();
    setToast({ msg: tr(locale, { uz: "Link holati yangilandi", ru: "Статус ссылки обновлён", en: "Link status updated", de: "Linkstatus aktualisiert" }), type: "ok" });
  });

  const onRegen = (id: string) => start(async () => {
    await regenerateCode(id);
    router.refresh();
    setToast({ msg: tr(locale, { uz: "Yangi kod yaratildi", ru: "Новый код создан", en: "New code generated", de: "Neuer Code generiert" }), type: "ok" });
  });

  const confirmDelete = () => {
    const d = pendingDelete;
    if (!d) return;
    setPendingDelete(null);
    start(async () => {
      if (d.kind === "link") await deleteLink(d.id);
      else await deleteVacancy(d.id);
      router.refresh();
      setToast({ msg: tr(locale, { uz: "O'chirildi", ru: "Удалено", en: "Deleted", de: "Gelöscht" }), type: "ok" });
    });
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vacancies
      .map((v) => {
        if (!platFilter) return v;
        const links = v.links.filter((l) => l.platform === platFilter);
        return {
          ...v,
          links,
          views: links.reduce((n, l) => n + l.views, 0),
          submissions: links.reduce((n, l) => n + l.submissions, 0),
          activeLinks: links.filter((l) => l.isActive && !l.expired).length,
        };
      })
      .filter((v) => {
        if (v.links.length === 0) return false;
        if (country && v.country !== country) return false;
        if (q) {
          const hay = `${v.title} ${v.company ?? ""} ${v.country ?? ""} ${v.links.map((l) => `${l.code} ${l.name ?? ""}`).join(" ")}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [vacancies, search, country, platFilter]);

  const exportCsv = () => {
    const rows = vacancies.flatMap((v) => v.links.map((l) => ({
      code: l.code,
      platform: platform(l.platform).label,
      vacancy: v.title,
      company: v.company ?? "",
      country: v.country ?? "",
      views: l.views,
      submissions: l.submissions,
      cvr: `${l.cvr}%`,
      status: l.expired
        ? tr(locale, { uz: "Muddati o'tgan", ru: "Истёк", en: "Expired", de: "Abgelaufen" })
        : l.isActive
          ? tr(locale, { uz: "Faol", ru: "Активна", en: "Active", de: "Aktiv" })
          : tr(locale, { uz: "Nofaol", ru: "Неактивна", en: "Inactive", de: "Inaktiv" }),
      date: l.createdAt,
    })));
    exportRows("havolalar", [
      { key: "code", label: tr(locale, { uz: "Kod", ru: "Код", en: "Code", de: "Code" }) },
      { key: "platform", label: tr(locale, { uz: "Platforma", ru: "Платформа", en: "Platform", de: "Plattform" }) },
      { key: "vacancy", label: tr(locale, { uz: "Vakansiya", ru: "Вакансия", en: "Vacancy", de: "Stelle" }) },
      { key: "company", label: tr(locale, { uz: "Kompaniya", ru: "Компания", en: "Company", de: "Unternehmen" }) },
      { key: "country", label: tr(locale, { uz: "Davlat", ru: "Страна", en: "Country", de: "Land" }) },
      { key: "views", label: tr(locale, { uz: "Ko'rishlar", ru: "Просмотры", en: "Views", de: "Aufrufe" }) },
      { key: "submissions", label: tr(locale, { uz: "Arizalar", ru: "Заявки", en: "Applications", de: "Bewerbungen" }) },
      { key: "cvr", label: "CVR" },
      { key: "status", label: tr(locale, { uz: "Status", ru: "Статус", en: "Status", de: "Status" }) },
      { key: "date", label: tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" }) },
    ], rows);
  };

  const tAll = tr(locale, { uz: "Barcha davlatlar", ru: "Все страны", en: "All countries", de: "Alle Länder" });
  const selectedCountry = countries.find((c) => c.name === country) ?? null;

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Toast — eski loyihadagi kabi yuqori o'ng burchakda */}
      {toast && (
        <div className={cn("fixed right-6 top-6 z-[95] flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium shadow-pop",
          toast.type === "ok"
            ? "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
            : "border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400")}>
          <Icon name={toast.type === "ok" ? "check" : "alert"} className="h-4 w-4" />
          {toast.msg}
        </div>
      )}

      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Maxsus Linklar", ru: "Специальные ссылки", en: "Special Links", de: "Spezielle Links" })}</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Vakansiya yaratish va unga maxsus link biriktirish", ru: "Создание вакансии и привязка к ней специальной ссылки", en: "Create a vacancy and attach a special link to it", de: "Eine Stelle erstellen und einen speziellen Link damit verknüpfen" })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCsv} className={btnOutline}>
            <Icon name="download" className="mr-2 h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export", de: "Export" })}
          </button>
          {canManage && (
            <button onClick={() => setCreate("existing")} className={btnOutline}>
              <Icon name="link" className="mr-2 h-4 w-4" /> {tr(locale, { uz: "Mavjud vakansiyaga link", ru: "Ссылка к существующей вакансии", en: "Link to existing vacancy", de: "Link zu bestehender Stelle" })}
            </button>
          )}
          {canManage && (
            <button onClick={() => setCreate("new")} className="flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
              <Icon name="plus" className="mr-2 h-4 w-4" /> {tr(locale, { uz: "Yangi kurs + Link", ru: "Новый курс + Ссылка", en: "New course + Link", de: "Neuer Kurs + Link" })}
            </button>
          )}
        </div>
      </div>

      {/* 4 ta ko'rsatkich */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon="link" tone="text-blue-500 dark:text-blue-400" label={tr(locale, { uz: "Jami linklar", ru: "Всего ссылок", en: "Total links", de: "Links insgesamt" })} value={nf(totals.totalLinks)} />
        <Tile icon="check" tone="text-emerald-500 dark:text-emerald-400" label={tr(locale, { uz: "Faol", ru: "Активные", en: "Active", de: "Aktiv" })} value={nf(totals.activeLinks)} />
        <Tile icon="eye" tone="text-purple-500 dark:text-purple-400" label={tr(locale, { uz: "Ko'rishlar", ru: "Просмотры", en: "Views", de: "Aufrufe" })} value={nf(totals.totalViews)} />
        <Tile icon="users" tone="text-amber-500 dark:text-amber-400" label={tr(locale, { uz: "Arizalar", ru: "Заявки", en: "Applications", de: "Bewerbungen" })} value={nf(totals.totalSubmissions)} />
      </div>

      {/* Platformalar statistikasi */}
      {platformStats.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Icon name="chart" className="h-4 w-4 text-slate-400" /> {tr(locale, { uz: "Platformalar statistikasi", ru: "Статистика платформ", en: "Platform statistics", de: "Plattformstatistik" })}
            </h2>
            {platFilter && (
              <button onClick={() => setPlatFilter(null)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700">
                {tr(locale, { uz: "Barcha platformalar", ru: "Все платформы", en: "All platforms", de: "Alle Plattformen" })} ✕
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {platformStats.map((p) => (
              <button
                key={p.key}
                onClick={() => setPlatFilter(platFilter === p.key ? null : p.key)}
                className={cn("relative overflow-hidden rounded-xl border p-3.5 text-left transition", platFilter === p.key ? "border-brand-400 ring-1 ring-brand-400" : "border-slate-200/70 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700")}
                style={{ background: `${p.color}14` }}
              >
                <span className="absolute bottom-0 left-0 h-1 rounded-b-xl opacity-70" style={{ width: `${p.sharePct}%`, background: p.color }} />
                <div className="mb-2.5 flex items-center gap-2">
                  <Icon name={p.icon} className="h-4 w-4" style={{ color: p.color }} />
                  <span className="text-xs font-semibold" style={{ color: p.color }}>{p.label}</span>
                </div>
                <div className="space-y-1.5">
                  <PlatRow label={tr(locale, { uz: "Linklar", ru: "Ссылки", en: "Links", de: "Links" })} value={p.links} />
                  <PlatRow icon="eye" label={tr(locale, { uz: "Ko'rishlar", ru: "Просмотры", en: "Views", de: "Aufrufe" })} value={p.views} />
                  <PlatRow icon="users" label={tr(locale, { uz: "Arizalar", ru: "Заявки", en: "Applications", de: "Bewerbungen" })} value={p.submissions} valueClass={p.submissions > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"} />
                  <div className="flex items-center justify-between border-t border-slate-200/70 pt-1 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400">{tr(locale, { uz: "Ulush", ru: "Доля", en: "Share", de: "Anteil" })}</span>
                    <span className="text-xs font-bold" style={{ color: p.color }}>{p.sharePct}%</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ma'lumot bloki */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
        <div className="flex items-start gap-3">
          <Icon name="link" className="mt-0.5 h-5 w-5 shrink-0 text-blue-500 dark:text-blue-400" />
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{tr(locale, { uz: "Kurs + Link yaratish", ru: "Создание курса + ссылки", en: "Create course + link", de: "Kurs + Link erstellen" })}</p>
            <p className="mt-1 text-xs text-blue-600/90 dark:text-blue-400">{tr(locale, {
              uz: "Kurs havolasini yarating (kurs nomi, daraja, narxi, tavsif) va avtomatik link oling. Yoki mavjud kursga qo'shimcha link yarating. Har bir havola /apply/<kod> ga olib boradi — ko'rishlar va arizalar avtomatik lid bo'lib tushadi.",
              ru: "Создайте ссылку на курс (название, уровень, цена, описание) и получите ссылку автоматически. Или добавьте дополнительную ссылку к существующему курсу. Каждая ссылка ведёт на /apply/<код> — просмотры и заявки автоматически становятся лидами.",
              en: "Create a course link (name, level, price, description) and get a link automatically. Or add an extra link to an existing course. Each link leads to /apply/<code> — views and applications automatically become leads.", de: "Erstellen Sie einen Kurslink (Name, Niveau, Preis, Beschreibung) und erhalten Sie automatisch einen Link. Oder fügen Sie einem bestehenden Kurs einen weiteren Link hinzu. Jeder Link führt zu /apply/<code> — Aufrufe und Bewerbungen werden automatisch zu Leads.",
            })}</p>
          </div>
        </div>
      </div>

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr(locale, { uz: "Link, vakansiya yoki davlat qidiring...", ru: "Поиск по ссылке, вакансии или стране...", en: "Search by link, vacancy or country...", de: "Suche nach Link, Stelle oder Land..." })}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="relative" ref={dropRef}>
          <button onClick={() => setCountryOpen((p) => !p)} className="flex min-w-[180px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
            <span className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              {selectedCountry ? <>{flagOf(selectedCountry.code, selectedCountry.name)} {selectedCountry.name}</> : <><Icon name="globe" className="h-4 w-4 text-slate-400" /> {tAll}</>}
            </span>
            <Icon name="chevronDown" className={cn("h-4 w-4 text-slate-400 transition-transform", countryOpen && "rotate-180")} />
          </button>
          {countryOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-[280px] w-[220px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-900">
              <button onClick={() => { setCountry(""); setCountryOpen(false); }} className={cn("flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800", !country ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300" : "text-slate-700 dark:text-slate-200")}>
                <Icon name="globe" className="h-4 w-4 text-slate-400" /> {tAll}
                {!country && <Icon name="check" className="ml-auto h-3.5 w-3.5" />}
              </button>
              {countries.map((c) => (
                <button key={c.name} onClick={() => { setCountry(c.name); setCountryOpen(false); }} className={cn("flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800", country === c.name ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300" : "text-slate-700 dark:text-slate-200")}>
                  <span>{flagOf(c.code, c.name)}</span> {c.name}
                  {country === c.name && <Icon name="check" className="ml-auto h-3.5 w-3.5" />}
                </button>
              ))}
              {countries.length === 0 && <p className="px-4 py-2 text-xs text-slate-400">{tr(locale, { uz: "Davlat yo'q", ru: "Стран нет", en: "No countries", de: "Keine Länder" })}</p>}
            </div>
          )}
        </div>

        <button onClick={() => router.refresh()} title={tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh", de: "Aktualisieren" })} aria-label={tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh", de: "Aktualisieren" })} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:hover:text-slate-100">
          <Icon name="refresh" className="h-4 w-4" />
        </button>
      </div>

      <LinksTable
        locale={locale}
        rows={shown}
        hasAny={vacancies.length > 0}
        canManage={canManage}
        origin={origin}
        copiedId={copiedId}
        expanded={expanded}
        onExpand={(id) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
        onCopy={copy}
        onToggle={onToggle}
        onRegen={onRegen}
        onQr={setQr}
        onDelete={setPendingDelete}
        onCreate={() => setCreate("new")}
      />

      {create && (
        <CreateLinkModal
          locale={locale}
          mode={create}
          vacancies={vacancyOptions}
          courses={courseOptions}
          preselectVacancyId={create === "existing" ? preselectVacancyId : null}
          onClose={() => setCreate(null)}
          onDone={(links) => { setCreate(null); router.refresh(); setCreated(links); }}
        />
      )}
      {created && <ResultLinksModal locale={locale} links={created} origin={origin} onClose={() => setCreated(null)} />}
      {qr && <QrModal locale={locale} code={qr} onClose={() => setQr(null)} />}
      {pendingDelete && <DeleteConfirmModal locale={locale} kind={pendingDelete.kind} label={pendingDelete.label} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />}
    </div>
  );
}

const btnOutline = "flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

function Tile({ icon, tone, label, value }: { icon: string; tone: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{value}</p>
      </div>
      <Icon name={icon} className={cn("h-8 w-8 opacity-30", tone)} />
    </div>
  );
}

function PlatRow({ icon, label, value, valueClass }: { icon?: string; label: string; value: number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1 text-[10px] text-slate-400">
        {icon && <Icon name={icon} className="h-3 w-3" />} {label}
      </span>
      <span className={cn("text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100", valueClass)}>{value}</span>
    </div>
  );
}
