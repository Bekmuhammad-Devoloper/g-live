import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { prisma } from "@/lib/db";
import { PageHeader } from "../_ui";
import { S } from "../_i18n";
import MissingStudent from "../MissingStudent";
import { allTags, buildGraph } from "./parse";
import NotesView, { type VNote } from "./NotesView";
import GraphButton from "./GraphButton";

// "Ikkinchi miya" (Zweites Gehirn) — o'quvchining shaxsiy bilim bazasi.
// Obsidian uslubi: yozuvlar [[sarlavha]] orqali bir-biriga bog'lanadi va
// bog'lanishlar grafda ko'rinadi.

export default async function BrainPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // ── Ikkinchi miya VAQTINCHA O'CHIRILGAN (2026-09-04) ──
  // Kartochkasi /student/profil da kommentga olingan; manzil orqali ham
  // kirilmasin deb shu yerda to'xtatiladi.
  // Qaytarish: BRAIN_ENABLED ni true qiling (yoki shu blokni o'chirib,
  // pastdagi eski qatorni tiklang).
  // ("as boolean" — TypeScript qolgan kodni "yetib bo'lmaydi" deb
  //  hisoblab, tip tekshiruvini buzmasligi uchun.)
  const BRAIN_ENABLED = false as boolean;
  if (!BRAIN_ENABLED) redirect("/student");
  // Eski holat (menejer paneli orqali boshqarish):
  // if (!(await isPortalFeatureOn("gehirn"))) redirect("/student");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!student) return <MissingStudent />;

  const rows = await prisma.note.findMany({
    where: { studentId: student.id },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, content: true, kind: true, tags: true, pinned: true, updatedAt: true },
  });

  const notes: VNote[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    kind: n.kind,
    pinned: n.pinned,
    updatedAt: n.updatedAt.toISOString(),
    tags: allTags(n),
  }));

  // Bog'lanishlar soni — grafdagi qirralar (matndan o'qiladi)
  const { links } = buildGraph(rows);
  const tags = [...new Set(notes.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-[18px]">
      <PageHeader title={t.brain} subtitle={t.brainSub} backLabel={t.back} back="/student/profil" right={<GraphButton title={t.graph} />} />
      <NotesView notes={notes} tags={tags} linkCount={links.length} t={t} />
    </div>
  );
}
