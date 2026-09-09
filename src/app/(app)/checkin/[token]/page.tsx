import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tr } from "@/lib/tr";
import { Card } from "../../_components/ui";
import CheckInButton from "./CheckInButton";

export default async function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await requireSession();

  const lesson = await prisma.lesson.findFirst({
    where: { qrToken: token },
    include: { group: true },
  });

  return (
    <div className="mx-auto max-w-sm pt-6">
      <Card>
        <div className="mb-4 text-center">
          <div className="mb-2 text-4xl">📲</div>
          <h1 className="text-lg font-bold text-slate-900">{tr(s.locale, { uz: "QR-davomat", ru: "QR-посещаемость", en: "QR attendance", de: "QR-Anwesenheit" })}</h1>
          {lesson ? (
            <p className="mt-1 text-sm text-slate-500">
              {lesson.group.name}
              {lesson.topic ? ` · ${lesson.topic}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-red-500">{tr(s.locale, { uz: "Dars topilmadi", ru: "Урок не найден", en: "Lesson not found", de: "Unterricht nicht gefunden" })}</p>
          )}
        </div>
        <CheckInButton token={token} locale={s.locale} />
      </Card>
    </div>
  );
}
