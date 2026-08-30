import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { S } from "../../_i18n";
import MissingStudent from "../../MissingStudent";
import { buildGraph } from "../parse";
import BrainGraph from "./BrainGraph";

// Bog'lanishlar xaritasi — to'liq ekranda (pastki menyu ko'rinmaydi).

export default async function BrainGraphPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!student) return <MissingStudent />;

  const rows = await prisma.note.findMany({
    where: { studentId: student.id },
    select: { id: true, title: true, content: true, kind: true },
  });

  const { nodes, links } = buildGraph(rows);

  return <BrainGraph nodes={nodes} links={links} t={t} />;
}
