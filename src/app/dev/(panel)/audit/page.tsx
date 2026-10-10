import { readDevAudit } from "@/lib/devpanel/auth";
import { Card, fmtDate } from "../ui";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  login: "Kirish", login_failed: "Kirish rad etildi", center_create_start: "Markaz yaratish boshlandi", center_created: "Markaz yaratildi",
  center_create_failed: "Markaz yaratishda xato", license_extend: "Litsenziya uzaytirildi", license_set: "Litsenziya sanasi o'rnatildi",
  center_suspend: "Markaz to'xtatildi", center_resume: "Markaz qayta yoqildi", modules_set: "Modullar o'zgartirildi", center_info: "Ma'lumotlar o'zgartirildi",
  director_password_reset: "Direktor paroli yangilandi", service_start: "Xizmat yoqildi", service_stop: "Xizmat to'xtatildi", service_restart: "Qayta ishga tushirildi",
  ssl_retry: "SSL qayta olindi", backup: "Zaxira olindi", center_delete: "Markaz o'chirildi", update_all: "Hammasi yangilandi", main_license_set: "Asosiy markaz litsenziyasi",
};

export default async function AuditPage() {
  const rows = await readDevAudit(500);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Amallar jurnali</h1>
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-white/[0.03]">
              <tr><th className="px-4 py-3">Vaqt</th><th className="px-4 py-3">Amal</th><th className="px-4 py-3">Markaz</th><th className="px-4 py-3">Tafsilot</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Yozuv yo'q</td></tr>}
              {rows.map((r, i) => {
                const { at, action, slug, ...rest } = r as { at: string; action: string; slug?: string; [k: string]: unknown };
                return (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtDate(at)} {at?.slice(11, 19)}</td>
                    <td className={`px-4 py-2.5 font-medium ${action.includes("fail") ? "text-red-600" : ""}`}>{LABELS[action] ?? action}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{slug ?? "—"}</td>
                    <td className="max-w-[420px] truncate px-4 py-2.5 font-mono text-[11px] text-slate-500">{JSON.stringify(rest)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
