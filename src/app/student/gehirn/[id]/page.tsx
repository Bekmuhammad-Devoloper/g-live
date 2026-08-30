import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { S } from "../../_i18n";
import MissingStudent from "../../MissingStudent";
import { allTags, backlinksOf, linkKey, parseLinks } from "../parse";
import NoteDetail, { type LinkRef } from "./NoteDetail";

// Bitta yozuv: matn, havolalar va "bu yozuvga havola qilganlar" (backlinks).

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!student) return <MissingStudent />;

  // Faqat O'Z yozuvi (id ni bilgan begona o'quvchi ham ocha olmaydi)
  const note = await prisma.note.findFirst({
    where: { id, studentId: student.id },
    select: { id: true, title: true, content: true, kind: true, tags: true, pinned: true, updatedAt: true },
  });
  if (!note) notFound();

  // Havolalarni yechish uchun barcha sarlavhalar kerak
  const all = await prisma.note.findMany({
    where: { studentId: student.id },
    select: { id: true, title: true, content: true, kind: true },
  });

  const ids: Record<string, string> = {};
  for (const n of all) ids[linkKey(n.title)] = n.id;

  const byKey = new Map(all.map((n) => [linkKey(n.title), n]));
  const outgoing: LinkRef[] = parseLinks(note.content).map((raw) => {
    const hit = byKey.get(linkKey(raw));
    return { id: hit?.id ?? null, title: hit?.title ?? raw, kind: hit?.kind ?? "NOTE" };
  });

  const incoming: LinkRef[] = backlinksOf(note, all).map((n) => ({ id: n.id, title: n.title, kind: n.kind }));

  return (
    <NoteDetail
      t={t}
      note={{
        id: note.id,
        title: note.title,
        content: note.content,
        kind: note.kind,
        tags: note.tags ?? "",
        pinned: note.pinned,
        updatedAt: note.updatedAt.toISOString(),
        shownTags: allTags(note),
      }}
      ids={ids}
      outgoing={outgoing}
      incoming={incoming}
    />
  );
}
