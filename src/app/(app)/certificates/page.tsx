import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { tr } from "@/lib/tr";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { PageHeader, Table, EmptyRow, Badge, Card, Forbidden } from "../_components/ui";
import { IssueForm, RevokeButton, ExportCertsButton, type CertExportRow } from "./CertControls";
import type { Prisma } from "@prisma/client";

const statusTone: Record<string, "green" | "slate" | "red"> = {
  ISSUED: "green",
  REPLACED: "slate",
  REVOKED: "red",
};

export default async function CertificatesPage() {
  const s = await requireSession();
  const t = getT(s.locale);

  if (!canRead(s.role, MODULES.CERTIFICATES)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  let where: Prisma.CertificateWhereInput = {};
  if (s.role === ROLES.STUDENT) {
    const st = await prisma.student.findUnique({ where: { userId: s.userId } });
    where = { studentId: st?.id ?? "__none__" };
  }

  const writable = canWrite(s.role, MODULES.CERTIFICATES);
  const [certs, students] = await Promise.all([
    prisma.certificate.findMany({ where, orderBy: { issuedAt: "desc" }, include: { student: true } }),
    writable ? prisma.student.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }) : Promise.resolve([]),
  ]);

  const exportRowsData: CertExportRow[] = certs.map((c) => ({
    number: c.number,
    student: c.student.fullName,
    program: `${c.programName} ${c.levelCode ?? ""}`.trim(),
    result: c.result ?? "—",
    status: c.status,
  }));

  return (
    <>
      <PageHeader
        title={t("nav.certificates")}
        subtitle={tr(s.locale, { uz: "Sertifikatlar va QR-tekshiruv (TZ 4.5)", ru: "Сертификаты и QR-проверка (ТЗ 4.5)", en: "Certificates and QR verification (TZ 4.5)" })}
        action={
          <div className="flex items-center gap-2">
            <ExportCertsButton rows={exportRowsData} locale={s.locale} />
            {writable && <IssueForm students={students} locale={s.locale} />}
          </div>
        }
      />

      {certs.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            {tr(s.locale, {
              uz: "Hozircha sertifikat berilmagan. Imtihon shartlari bajarilganda sertifikat noyob raqam va tekshiruv QR-kodi bilan beriladi.",
              ru: "Пока сертификаты не выданы. При выполнении условий экзамена сертификат выдаётся с уникальным номером и QR-кодом для проверки.",
              en: "No certificates issued yet. Once the exam requirements are met, a certificate is issued with a unique number and a verification QR code.",
            })}
          </p>
        </Card>
      ) : (
        <Table
          head={
            <tr>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Raqam", ru: "Номер", en: "Number" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Dastur / daraja", ru: "Программа / уровень", en: "Program / level" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Natija", ru: "Результат", en: "Result" })}</th>
              <th className="px-4 py-3">{t("common.status")}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Tekshirish", ru: "Проверка", en: "Verify" })}</th>
              {writable && <th className="px-4 py-3">{t("common.actions")}</th>}
            </tr>
          }
        >
          {certs.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.number}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{c.student.fullName}</td>
              <td className="px-4 py-3 text-slate-600">{c.programName} {c.levelCode}</td>
              <td className="px-4 py-3 text-slate-600">{c.result ?? "—"}</td>
              <td className="px-4 py-3"><Badge tone={statusTone[c.status] ?? "slate"}>{c.status}</Badge></td>
              <td className="px-4 py-3">
                <Link href={`/verify/${c.qrCode}`} target="_blank" className="text-xs text-brand-600 hover:underline">
                  🔗 {tr(s.locale, { uz: "QR sahifa", ru: "QR-страница", en: "QR page" })}
                </Link>
              </td>
              {writable && (
                <td className="px-4 py-3">
                  {c.status !== "REVOKED" ? <RevokeButton id={c.id} locale={s.locale} /> : <span className="text-xs text-slate-400">—</span>}
                </td>
              )}
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
