import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "../../_components/ui";
import CheckInButton from "./CheckInButton";

export default async function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await requireSession();

  const lesson = await prisma.lesson.findFirst({
    where: { qrToken: token },
    include: { group: true },
  });

  return (
    <div className="mx-auto max-w-sm pt-6">
      <Card>
        <div className="mb-4 text-center">
          <div className="mb-2 text-4xl">📲</div>
          <h1 className="text-lg font-bold text-slate-900">QR-davomat</h1>
          {lesson ? (
            <p className="mt-1 text-sm text-slate-500">
              {lesson.group.name}
              {lesson.topic ? ` · ${lesson.topic}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-red-500">Dars topilmadi</p>
          )}
        </div>
        <CheckInButton token={token} />
      </Card>
    </div>
  );
}
