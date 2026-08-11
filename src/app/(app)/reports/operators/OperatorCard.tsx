"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import UserAvatar from "../../_components/UserAvatar";
import type { VOperator } from "./OperatorsBoard";

// Bitta operator kartasi — avatar/status, kunlik ko'rsatkichlar, konversiya,
// oxirgi faollik, kirish ma'lumotlari (yopiladigan) va amallar.

export const kpiColor = (v: number) => (v >= 35 ? "#10b981" : v >= 25 ? "#f59e0b" : "#ef4444");
export const fmtTalk = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}s ${m}m` : `${m}m`;
};

interface Props {
  locale: Locale;
  op: VOperator;
  canManage: boolean;
  onTask: () => void;
  onNotify: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

export default function OperatorCard({ locale, op, canManage, onTask, onNotify, onEdit, onArchive }: Props) {
  const [showLogin, setShowLogin] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const statusText = op.onCall
    ? tr(locale, { uz: "Qo'ng'iroqda", ru: "На звонке", en: "On call" })
    : op.online
      ? "Online"
      : "Offline";
  const statusCls = op.onCall ? "text-amber-500" : op.online ? "text-emerald-500" : "text-slate-400";
  const dotCls = op.onCall ? "bg-amber-400 animate-pulse" : op.online ? "bg-emerald-500" : "bg-slate-400";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card transition hover:border-brand-300/60 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="p-4 pb-0">
        {/* Sarlavha: avatar + ism + amallar */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <UserAvatar name={op.name} imageUrl={op.avatar} role="MANAGER" size="md" />
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900", dotCls)} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold leading-tight text-slate-800 dark:text-slate-100">{op.name}</h3>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className={cn("text-[10px] font-semibold", statusCls)}>{statusText}</span>
                {op.sip && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">SIP: {op.sip}</span>}
              </div>
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 items-center gap-0.5">
              <IconBtn title={tr(locale, { uz: "Topshiriq berish", ru: "Дать задачу", en: "Assign task" })} icon="clipboard" hover="hover:text-brand-500 hover:bg-brand-500/10" onClick={onTask} />
              <IconBtn title={tr(locale, { uz: "Xabar yuborish", ru: "Отправить сообщение", en: "Send message" })} icon="bell" hover="hover:text-amber-500 hover:bg-amber-500/10" onClick={onNotify} />
              <IconBtn title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit" })} icon="edit" hover="hover:text-blue-500 hover:bg-blue-500/10" onClick={onEdit} />
              <IconBtn title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Remove" })} icon="trash" hover="hover:text-red-500 hover:bg-red-500/10" onClick={onArchive} />
            </div>
          )}
        </div>

        {/* Telefon */}
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Icon name="phone" className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span>{op.phone || "—"}</span>
        </div>

        {/* Kunlik ko'rsatkichlar */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <MiniStat icon="phoneCall" tone="text-cyan-500" value={String(op.dayCalls)} label={tr(locale, { uz: "Kunlik qo'ng'iroq", ru: "Звонков за день", en: "Calls that day" })} />
          <MiniStat icon="clock" tone="text-amber-500" value={fmtTalk(op.dayTalkSec)} label={tr(locale, { uz: "Gaplashgan", ru: "Наговорено", en: "Talk time" })} />
        </div>

        <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />

        {/* Konversiya */}
        <div className="py-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <Icon name="chart" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Konversiya", ru: "Конверсия", en: "Conversion" })}
            </span>
            <span className="text-sm font-bold" style={{ color: kpiColor(op.conv) }}>{op.conv}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, op.conv)}%`, background: kpiColor(op.conv) }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
            <span>{tr(locale, { uz: "Muvaffaqiyatli", ru: "Успешные", en: "Successful" })}: <b className="text-emerald-600 dark:text-emerald-400">{op.won}</b></span>
            <span>{tr(locale, { uz: "Jami", ru: "Всего", en: "Total" })}: <b className="text-slate-600 dark:text-slate-300">{op.total}</b></span>
          </div>
        </div>

        <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />

        {/* Oxirgi faollik */}
        <div className="space-y-2 py-3 text-[10px] text-slate-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Icon name="clock" className="h-3 w-3" /> {tr(locale, { uz: "Oxirgi online", ru: "Последний онлайн", en: "Last online" })}:</span>
            <span className="font-medium text-slate-600 dark:text-slate-300">{op.lastOnline}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Icon name="user" className="h-3 w-3" /> {tr(locale, { uz: "Oxirgi lid", ru: "Последний лид", en: "Last lead" })}:</span>
            <span className="max-w-[150px] truncate font-medium text-slate-600 dark:text-slate-300">{op.lastLead ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Icon name="phoneCall" className="h-3 w-3" /> {tr(locale, { uz: "Oxirgi qo'ng'iroq", ru: "Последний звонок", en: "Last call" })}:</span>
            <span className="max-w-[150px] truncate font-medium text-slate-600 dark:text-slate-300">{op.lastCall ?? "—"}</span>
          </div>
        </div>

        {canManage && (
          <>
            <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />
            <div className="py-3">
              <button
                type="button"
                onClick={() => setShowLogin((v) => !v)}
                className="flex w-full items-center gap-2 text-[11px] font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="shield" className="h-3.5 w-3.5" />
                <span>{tr(locale, { uz: "Kirish ma'lumotlari", ru: "Данные входа", en: "Login details" })}</span>
                <Icon name="chevronDown" className={cn("ml-auto h-3 w-3 transition-transform", showLogin && "rotate-180")} />
              </button>
              {showLogin && (
                <div className="mt-2.5 space-y-2.5 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.03]">
                  <CredRow
                    label="Login"
                    value={op.email}
                    copied={copied === "login"}
                    onCopy={() => copy(op.email, "login")}
                  />
                  <CredRow
                    label={tr(locale, { uz: "Parol", ru: "Пароль", en: "Password" })}
                    value={op.password ?? "••••••••"}
                    copied={copied === "pass"}
                    onCopy={op.password ? () => copy(op.password as string, "pass") : undefined}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Pastki qator */}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 text-[10px] text-slate-400 dark:bg-white/[0.03]">
        <span>{tr(locale, { uz: "Yaratilgan", ru: "Создан", en: "Created" })}: {op.createdAt}</span>
        <Link href={`/reports/operators/${op.id}`} className="flex items-center gap-1 font-semibold text-brand-600 transition hover:underline dark:text-brand-300">
          <Icon name="eye" className="h-3 w-3" /> {tr(locale, { uz: "Batafsil", ru: "Подробнее", en: "Details" })}
        </Link>
      </div>
    </div>
  );
}

function IconBtn({ title, icon, hover, onClick }: { title: string; icon: string; hover: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick} className={cn("rounded-lg p-1.5 text-slate-400 transition", hover)}>
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function MiniStat({ icon, tone, value, label }: { icon: string; tone: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.03]">
      <Icon name={icon} className={cn("h-4 w-4 shrink-0", tone)} />
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p>
        <p className="truncate text-[9px] text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function CredRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-400">{label}:</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-[11px] font-medium text-slate-700 dark:text-slate-200">{value}</span>
        {onCopy && (
          <button type="button" onClick={onCopy} className="rounded p-1 text-slate-400 transition hover:bg-slate-200 dark:hover:bg-slate-700">
            <Icon name={copied ? "check" : "copy"} className={cn("h-3 w-3", copied && "text-emerald-500")} />
          </button>
        )}
      </div>
    </div>
  );
}
