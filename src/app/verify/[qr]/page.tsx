import { prisma } from "@/lib/db";

// Ochiq sahifa (login talab qilmaydi) — sertifikat QR-kodini tekshirish.
export default async function VerifyPage({ params }: { params: Promise<{ qr: string }> }) {
  const { qr } = await params;
  const cert = await prisma.certificate.findFirst({
    where: { qrCode: qr },
    include: { student: true },
  });

  const valid = cert && cert.status === "ISSUED";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-200 bg-brand-600 px-5 py-4 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">GL</div>
          <div>
            <div className="text-sm font-bold">Germaniya Live</div>
            <div className="text-[11px] text-white/70">Sertifikat haqiqiyligini tekshirish</div>
          </div>
        </div>

        <div className="p-6">
          {!cert ? (
            <div className="text-center">
              <div className="mb-2 text-4xl">❓</div>
              <h1 className="text-lg font-bold text-slate-800">Topilmadi</h1>
              <p className="mt-1 text-sm text-slate-500">Bunday QR-kodli sertifikat mavjud emas.</p>
            </div>
          ) : (
            <>
              <div
                className={`mb-5 rounded-xl border p-4 text-center ${
                  valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                }`}
              >
                <div className="mb-1 text-3xl">{valid ? "✅" : "⛔"}</div>
                <div className={`text-base font-bold ${valid ? "text-emerald-700" : "text-red-700"}`}>
                  {valid ? "Haqiqiy — amal qiladi" : cert.status === "REVOKED" ? "Bekor qilingan" : "Amal qilmaydi"}
                </div>
              </div>

              <dl className="space-y-2.5 text-sm">
                <Row label="Sertifikat raqami" value={cert.number} mono />
                <Row label="F.I.Sh." value={cert.student.fullName} />
                <Row label="Dastur" value={`${cert.programName}${cert.levelCode ? " · " + cert.levelCode : ""}`} />
                {cert.result && <Row label="Natija" value={cert.result} />}
                <Row label="Berilgan sana" value={new Intl.DateTimeFormat("uz-UZ").format(cert.issuedAt)} />
                {cert.issuedBy && <Row label="Bergan" value={cert.issuedBy} />}
              </dl>
            </>
          )}
        </div>
        <div className="border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-400">
          © 2026 Germaniya Live
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`text-right font-medium text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
