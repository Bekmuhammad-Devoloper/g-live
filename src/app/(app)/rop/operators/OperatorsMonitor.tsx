"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import UserAvatar from "../../_components/UserAvatar";
import { setStaffImage } from "../../users/actions";

export interface VOperator {
  id: string;
  name: string;
  phone: string;
  imageUrl?: string | null;
  todayCalls: number;
  talkMin: number;
  total: number;
  won: number;
  conv: number;
  online: boolean;
  lastOnline: string | null; // ISO
  lastLead: string | null;
  createdAt: string; // ISO
}

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => { const d = new Date(iso); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`; };
function ago(iso: string | null, locale: Locale): string {
  if (!iso) return tr(locale, { uz: "hech qachon", ru: "никогда", en: "never" });
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return tr(locale, { uz: "hozir", ru: "сейчас", en: "now" });
  if (m < 60) return tr(locale, { uz: `${m} daqiqa oldin`, ru: `${m} мин назад`, en: `${m} min ago` });
  const h = Math.floor(m / 60);
  if (h < 24) return tr(locale, { uz: `${h} soat oldin`, ru: `${h} ч назад`, en: `${h} h ago` });
  const days = Math.floor(h / 24);
  return tr(locale, { uz: `${days} kun oldin`, ru: `${days} дн назад`, en: `${days} days ago` });
}
function fmtTalk(min: number): string {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}s ${min % 60}m`;
}

export default function OperatorsMonitor({ operators, totalLeads, todayCalls, writable, locale }: { operators: VOperator[]; totalLeads: number; todayCalls: number; writable: boolean; locale: Locale }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "online" | "offline">("all");

  const onlineCount = operators.filter((o) => o.online).length;
  const avgKpi = operators.length ? Math.round(operators.reduce((n, o) => n + o.conv, 0) / operators.length) : 0;

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return operators.filter((o) => {
      if (tab === "online" && !o.online) return false;
      if (tab === "offline" && o.online) return false;
      if (n && !o.name.toLowerCase().includes(n) && !o.phone.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [operators, q, tab]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white"><Icon name="headphones" className="h-6 w-6" /></div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Operatorlar", ru: "Операторы", en: "Operators" })}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Sotuv menejerlarini boshqarish va monitoring", ru: "Управление и мониторинг менеджеров по продажам", en: "Sales manager management and monitoring" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.refresh()} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Icon name="refresh" className="h-4 w-4" /> {tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh" })}
          </button>
          {writable && (
            <Link href="/reports/operators" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yangi operator", ru: "Новый оператор", en: "New operator" })}
            </Link>
          )}
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon="users" tone="brand" value={operators.length} label="Jami" />
        <Stat icon="check" tone="green" value={onlineCount} label="Online" />
        <Stat icon="chart" tone="amber" value={`${avgKpi}%`} label="O'rtacha KPI" />
        <Stat icon="download" tone="violet" value={totalLeads} label="Jami lidlar" />
        <Stat icon="phone" tone="brand" value={todayCalls} label="Bugungi qo'ng'iroqlar" />
      </div>

      {/* Search + tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Operator qidirish..."
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-1 dark:border-slate-700 dark:bg-slate-800/40">
          {([["all", "Barchasi"], ["online", "Online"], ["offline", "Offline"]] as const).map(([k, lb]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition", tab === k ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}>
              {lb}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-16 text-center text-sm text-slate-400 shadow-card dark:border-slate-800 dark:bg-slate-900">Operator topilmadi</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => (
            <div key={o.id} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <OperatorAvatar op={o} writable={writable} locale={locale} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{o.name}</div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={cn("font-medium", o.online ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")}>{o.online ? "Online" : "Offline"}</span>
                    {o.phone && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent("glive:call", { detail: { number: o.phone, contactName: o.name } })); }}
                        title="Qo'ng'iroq"
                        className="text-slate-400 transition hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        · {o.phone}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-lg bg-slate-50/70 px-3 py-2 dark:bg-slate-800/40">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{o.todayCalls}</div>
                  <div className="text-[11px] text-slate-400">Bugun qo&apos;ng&apos;iroq</div>
                </div>
                <div className="rounded-lg bg-slate-50/70 px-3 py-2 dark:bg-slate-800/40">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{fmtTalk(o.talkMin)}</div>
                  <div className="text-[11px] text-slate-400">Gaplashgan</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><Icon name="chart" className="h-3.5 w-3.5" /> Konversiya</span>
                  <span className={cn("font-bold", o.conv >= 30 ? "text-emerald-600 dark:text-emerald-400" : o.conv > 0 ? "text-amber-600 dark:text-amber-400" : "text-rose-500")}>{o.conv}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={cn("h-full rounded-full", o.conv >= 30 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${Math.min(100, o.conv)}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                  <span>Muvaffaqiyatli: <b className="text-slate-600 dark:text-slate-300">{o.won}</b></span>
                  <span>Jami: <b className="text-slate-600 dark:text-slate-300">{o.total}</b></span>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <div className="flex justify-between"><span className="text-slate-400">Oxirgi online:</span><span className="text-slate-600 dark:text-slate-300">{ago(o.lastOnline, locale)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Oxirgi lid:</span><span className="truncate pl-2 text-slate-600 dark:text-slate-300">{o.lastLead ?? "—"}</span></div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-[11px] text-slate-400">Yaratilgan: {fmtDate(o.createdAt)}</span>
                <Link href="/reports/operators" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"><Icon name="eye" className="h-3.5 w-3.5" /> Batafsil</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const statTone: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
};

function Stat({ icon, tone, value, label }: { icon: string; tone: string; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", statTone[tone] ?? statTone.brand)}><Icon name={icon} className="h-5 w-5" /></div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none text-slate-900 dark:text-slate-100">{value}</div>
        <div className="mt-1 truncate text-xs text-slate-400">{label}</div>
      </div>
    </div>
  );
}

// Operator avatari — rasm bo'lsa rasm, bo'lmasa ism bosh harflari.
// writable bo'lsa: ustiga bosib rasm yuklash/almashtirish (220px JPEG ga siqiladi).
function OperatorAvatar({ op, writable, locale }: { op: VOperator; writable: boolean; locale: Locale }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 220, scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        start(async () => { const r = await setStaffImage(op.id, c.toDataURL("image/jpeg", 0.82)); if (r.ok) router.refresh(); });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="group/av relative h-11 w-11 shrink-0">
      {op.imageUrl ? (
        <span className="block h-11 w-11 rounded-full bg-cover bg-center ring-1 ring-black/5 dark:ring-white/10" style={{ backgroundImage: `url(${op.imageUrl})` }} />
      ) : (
        <UserAvatar name={op.name} role="MANAGER" size="md" className="!rounded-full" />
      )}
      <span className={cn("pointer-events-none absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900", op.online ? "bg-emerald-500" : "bg-slate-400")} />
      {writable && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title={op.imageUrl
              ? tr(locale, { uz: "Rasmni almashtirish", ru: "Заменить фото", en: "Change photo" })
              : tr(locale, { uz: "Rasm yuklash", ru: "Загрузить фото", en: "Upload photo" })}
            className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover/av:opacity-100 disabled:opacity-100"
          >
            {busy ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="camera" className="h-4 w-4" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </>
      )}
    </div>
  );
}
