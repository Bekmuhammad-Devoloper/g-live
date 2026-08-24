"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { getT } from "@/lib/i18n";
import { LOCALES, intlLocale, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, label, type Locale } from "@/lib/constants";
import { logout, setLocale, setBranch, quickCreateStudent, type QuickState } from "../actions";
import { createManualPayment, type PayState } from "../payments/actions";
import { Icon } from "./Icon";
import UserAvatar from "./UserAvatar";
import ThemeToggle from "./ThemeToggle";
import CurrencyRates from "./CurrencyRates";

export interface TopbarProps {
  locale: Locale;
  unreadCount: number;
  user: { fullName: string; role: string; imageUrl: string | null; roleLabel: string; branchName: string | null };
  branches: { id: string; name: string }[];
  currentBranchId: string | null;
  canSwitchBranch: boolean;
  canCreateStudent: boolean;
  canCreatePayment: boolean;
  students: { id: string; fullName: string }[];
  groups: { id: string; name: string }[];
  upcoming: { id: string; groupId: string; groupName: string; topic: string | null; startsAt: string }[];
  subscriptionUntil: string | null;
  onMenu: () => void;
  appName: string;
}

type Menu = "new" | "branch" | "calendar" | "video" | "user" | null;
type Modal = "student" | "payment" | null;

// Ro'yxat umumiy manbadan (constants.ts) — bu yerda dublikat saqlanmaydi

export default function Topbar(p: TopbarProps) {
  const t = getT(p.locale);
  const router = useRouter();
  const [menu, setMenu] = useState<Menu>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [pending, start] = useTransition();

  const close = () => setMenu(null);
  const toggle = (m: Menu) => setMenu((cur) => (cur === m ? null : m));

  // ── Obuna qolgan kun ──
  const daysLeft = p.subscriptionUntil
    ? Math.ceil((new Date(p.subscriptionUntil).getTime() - Date.now()) / 86400000)
    : null;

  // ── Butun ekran ──
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale(p.locale), { day: "2-digit", month: "2-digit" }).format(new Date(iso));
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale(p.locale), { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const iconBtn =
    "relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200";

  return (
    <>
      {menu && <div className="fixed inset-0 z-30" onClick={close} />}

      <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-slate-200/70 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 md:px-4">
        {/* Mobil menyu */}
        <button onClick={p.onMenu} className={cn(iconBtn, "md:hidden")} aria-label="Menu">
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-slate-900 md:hidden">{p.appName}</span>

        {/* 1) + Yaratish */}
        {(p.canCreateStudent || p.canCreatePayment) && (
          <div className="relative">
            <button
              onClick={() => toggle("new")}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-600 transition hover:bg-brand-50"
              title={t("top.new")}
            >
              <Icon name="plus" className="h-6 w-6" />
            </button>
            {menu === "new" && (
              <Panel className="left-0 w-52">
                {p.canCreateStudent && (
                  <MenuItem icon="graduation" onClick={() => { close(); setModal("student"); }}>
                    {t("top.newStudent")}
                  </MenuItem>
                )}
                {p.canCreatePayment && (
                  <MenuItem icon="card" onClick={() => { close(); setModal("payment"); }}>
                    {t("top.newPayment")}
                  </MenuItem>
                )}
              </Panel>
            )}
          </div>
        )}

        {/* 2) Filiallar */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => toggle("branch")}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title={t("top.branches")}
          >
            <Icon name="building" className="h-4 w-4 text-slate-400" />
            <span className="max-w-[110px] truncate">{p.user.branchName ?? t("top.branches")}</span>
            <Icon name="chevronDown" className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {menu === "branch" && (
            <Panel className="left-0 w-60">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t("top.branches")}
              </div>
              {p.branches.map((b) => (
                <button
                  key={b.id}
                  disabled={!p.canSwitchBranch || pending}
                  onClick={() => start(async () => { await setBranch(b.id); close(); router.refresh(); })}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition",
                    b.id === p.currentBranchId ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50",
                    !p.canSwitchBranch && "cursor-not-allowed opacity-60"
                  )}
                >
                  <span className="truncate">{b.name}</span>
                  {b.id === p.currentBranchId && <span className="text-brand-600">✓</span>}
                </button>
              ))}
              {!p.canSwitchBranch && (
                <p className="px-3 py-2 text-[11px] text-slate-400">Filial almashtirish huquqi yo&apos;q</p>
              )}
              {p.canSwitchBranch && (
                <>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <Link
                    href="/branches"
                    onClick={close}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                  >
                    <Icon name="plus" className="h-4 w-4" /> {t("top.addBranch")}
                  </Link>
                </>
              )}
            </Panel>
          )}
        </div>

        {/* 3) Qidiruv */}
        <SearchBox locale={p.locale} placeholder={t("top.searchPlaceholder")} noResults={t("top.noResults")} />

        {/* 4) Obuna vaqti */}
        {daysLeft !== null && (
          <div
            className={cn(
              "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium xl:flex",
              daysLeft <= 7
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
            )}
            title={t("top.subscription")}
          >
            <Icon name="calendar" className="h-3.5 w-3.5" />
            <span>
              {daysLeft > 0 ? `${daysLeft} ${t("top.daysLeft")}` : "—"}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* 5) Valyuta kursi — MB (cbu.uz), avtomatik yangilanadi */}
        <CurrencyRates locale={p.locale} />

        {/* 6) Til */}
        <div className="hidden rounded-lg border border-slate-200 p-0.5 dark:border-slate-700 sm:flex">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => start(async () => { await setLocale(l); router.refresh(); })}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition",
                l === p.locale
                  ? "bg-slate-900 text-white dark:bg-brand-600"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              {l === "en" ? "eng" : l}
            </button>
          ))}
        </div>

        {/* Light / Dark rejim */}
        <ThemeToggle />

        {/* 7) Butun ekran */}
        <button onClick={toggleFs} className={cn(iconBtn, "hidden sm:flex")} title={t("top.fullscreen")}>
          <Icon name="expand" className="h-5 w-5" />
        </button>

        {/* 8) Kalendar */}
        <div className="relative hidden sm:block">
          <button onClick={() => toggle("calendar")} className={iconBtn} title={t("top.calendar")}>
            <Icon name="calendar" className="h-5 w-5" />
          </button>
          {menu === "calendar" && (
            <Panel className="right-0 w-72">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t("top.upcoming")}
              </div>
              {p.upcoming.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-400">{t("common.noData")}</p>
              ) : (
                p.upcoming.map((l) => (
                  <Link
                    key={l.id}
                    href={`/groups/${l.groupId}/lessons/${l.id}`}
                    onClick={close}
                    className="flex items-center gap-3 px-3 py-2 transition hover:bg-slate-50"
                  >
                    <div className="flex h-9 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 leading-none text-brand-700">
                      <span className="text-[11px] font-bold">{fmtDate(l.startsAt)}</span>
                      <span className="mt-0.5 text-[9px]">{fmtTime(l.startsAt)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">{l.groupName}</div>
                      <div className="truncate text-[11px] text-slate-400">{l.topic ?? "—"}</div>
                    </div>
                  </Link>
                ))
              )}
            </Panel>
          )}
        </div>

        {/* 9) Video qo'llanmalar — Telegram kanal (@GermaniyaLiveEdu) */}
        <div className="hidden sm:block">
          <a
            href="https://t.me/GermaniyaLiveEdu"
            target="_blank"
            rel="noopener noreferrer"
            className={iconBtn}
            title={t("top.video")}
          >
            <Icon name="video" className="h-5 w-5" />
          </a>
        </div>

        {/* 10) Bildirishnoma */}
        <Link href="/notifications" className={iconBtn} title={t("nav.notifications")}>
          <Icon name="bell" className="h-5 w-5" />
          {p.unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {p.unreadCount > 9 ? "9+" : p.unreadCount}
            </span>
          )}
        </Link>

        {/* 11) Avatar */}
        <div className="relative">
          <button onClick={() => toggle("user")} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-slate-100 dark:hover:bg-slate-800">
            <UserAvatar name={p.user.fullName} imageUrl={p.user.imageUrl} role={p.user.role} size="sm" className="!h-8 !w-8 !rounded-full" />
            <Icon name="chevronDown" className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </button>
          {menu === "user" && (
            <Panel className="right-0 w-60">
              <Link href="/profile" onClick={() => setMenu(null)} className="block border-b border-slate-100 px-3 py-2.5 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.user.fullName}</div>
                <div className="truncate text-[11px] text-slate-400">
                  {p.user.roleLabel}
                  {p.user.branchName ? ` · ${p.user.branchName}` : ""}
                </div>
              </Link>
              <Link href="/profile" onClick={() => setMenu(null)} className="flex w-full items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">
                <Icon name="user" className="h-4 w-4 text-slate-400" />
                {p.locale === "ru" ? "Мой профиль" : p.locale === "en" ? "My profile" : "Mening profilim"}
              </Link>
              {/* Kichik ekranda valyuta kursi navbarga sig'maydi — menyuda ko'rsatamiz */}
              <div className="xl:hidden">
                <CurrencyRates locale={p.locale} variant="menu" />
              </div>
              {/* Mobil uchun til */}
              <div className="flex gap-1 border-b border-slate-100 px-3 py-2 sm:hidden">
                {LOCALES.map((l) => (
                  <button
                    key={l}
                    onClick={() => start(async () => { await setLocale(l); router.refresh(); })}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1 text-[11px] font-semibold uppercase",
                      l === p.locale ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {l === "en" ? "eng" : l}
                  </button>
                ))}
              </div>
              <form action={logout}>
                <button className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50">
                  <Icon name="logout" className="h-4 w-4 text-slate-400" />
                  {t("common.logout")}
                </button>
              </form>
            </Panel>
          )}
        </div>
      </header>

      {/* Modallar */}
      {modal === "student" && <QuickStudentModal locale={p.locale} groups={p.groups} onClose={() => setModal(null)} />}
      {modal === "payment" && (
        <QuickPaymentModal locale={p.locale} students={p.students} onClose={() => setModal(null)} />
      )}
    </>
  );
}

// ─────────── Yordamchi komponentlar ───────────


function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("absolute top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800", className)}>
      {children}
    </div>
  );
}

function MenuItem({ icon, onClick, children }: { icon: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60">
      <Icon name={icon} className="h-4 w-4 text-slate-400" />
      {children}
    </button>
  );
}

function SearchBox({ locale, placeholder, noResults }: { locale: Locale; placeholder: string; noResults: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ type: string; id: string; title: string; subtitle: string | null; href: string }[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setHits(d.hits ?? []);
      } catch { setHits([]); }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const typeLabel: Record<string, string> = {
    student: locale === "ru" ? "Ученик" : locale === "en" ? "Student" : "O'quvchi",
    lead: locale === "ru" ? "Лид" : "Lead",
    group: locale === "ru" ? "Группа" : locale === "en" ? "Group" : "Guruh",
    teacher: locale === "ru" ? "Препод." : locale === "en" ? "Teacher" : "O'qituvchi",
  };

  return (
    <div ref={boxRef} className="relative hidden min-w-0 flex-1 md:block md:max-w-md">
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-brand-900"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800">
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-400">{noResults}</p>
          ) : (
            hits.map((h) => (
              <Link
                key={`${h.type}-${h.id}`}
                href={h.href}
                onClick={() => { setOpen(false); setQ(""); }}
                className="flex items-center justify-between gap-2 px-3 py-2 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{h.title}</div>
                  {h.subtitle && <div className="truncate text-[11px] text-slate-400">{h.subtitle}</div>}
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {typeLabel[h.type] ?? h.type}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function QuickStudentModal({ locale, groups, onClose }: { locale: Locale; groups: { id: string; name: string }[]; onClose: () => void }) {
  const t = getT(locale);
  const router = useRouter();
  const [state, action, pending] = useActionState<QuickState, FormData>(quickCreateStudent, {});
  useEffect(() => { if (state.ok) { onClose(); router.refresh(); } }, [state.ok, onClose, router]);

  const lbl = "mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300";

  return (
    <ModalShell title={t("top.newStudent")} onClose={onClose}>
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Ism <span className="text-red-500">*</span></label>
            <input name="firstName" required className="input" placeholder="Ism" />
          </div>
          <div>
            <label className={lbl}>Familiya</label>
            <input name="lastName" className="input" placeholder="Familiya" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>{t("common.phone")}</label>
            <input name="phone" className="input" placeholder="+998..." />
          </div>
          <div>
            <label className={lbl}>Qo&apos;shimcha raqam</label>
            <input name="phone2" className="input" placeholder="+998... (ixtiyoriy)" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Yosh</label>
            <input name="age" type="number" min="3" max="100" className="input" placeholder="18" />
          </div>
          <div>
            <label className={lbl}>Daraja</label>
            <input name="currentLevel" className="input" placeholder="A1.1" />
          </div>
        </div>

        {/* Guruhga yo'naltirish — tanlansa talaba darhol guruhga biriktiriladi */}
        <div>
          <label className={lbl}>Guruhga yo&apos;naltirish</label>
          <select name="groupId" className="input" defaultValue="">
            <option value="">Guruhsiz (keyinroq biriktiriladi)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">Guruh tanlansa — talaba faol holatga o&apos;tadi.</p>
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
            {state.error === "forbidden" ? t("err.forbiddenBody") : "Ma'lumot to'liq emas."}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">{t("common.cancel")}</button>
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "..." : t("common.save")}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function QuickPaymentModal({
  locale, students, onClose,
}: { locale: Locale; students: { id: string; fullName: string }[]; onClose: () => void }) {
  const t = getT(locale);
  const router = useRouter();
  const [state, action, pending] = useActionState<PayState, FormData>(createManualPayment, {});
  useEffect(() => { if (state.ok) { onClose(); router.refresh(); } }, [state.ok, onClose, router]);

  return (
    <ModalShell title={t("top.newPayment")} onClose={onClose}>
      <form action={action} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{t("pay.student")} <span className="text-red-500">*</span></label>
          <select name="studentId" required className="input" defaultValue="">
            <option value="" disabled>—</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{t("common.amount")} <span className="text-red-500">*</span></label>
            <input name="amount" type="number" min="1" step="10000" required className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{t("pay.method")} <span className="text-red-500">*</span></label>
            <select name="method" required className="input" defaultValue="CASH">
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(PAYMENT_METHOD_LABELS, m, locale)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{t("pay.purpose")} <span className="text-red-500">*</span></label>
          <input name="purpose" required className="input" placeholder="A1.2 kurs to'lovi" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{t("pay.docNumber")} <span className="text-red-500">*</span></label>
          <input name="docNumber" required className="input" placeholder="CHK-0003" />
        </div>
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error === "forbidden" ? t("pay.noPermission") : "Barcha majburiy maydonlarni to'ldiring."}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">{t("common.cancel")}</button>
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "..." : t("common.save")}</button>
        </div>
      </form>
    </ModalShell>
  );
}
