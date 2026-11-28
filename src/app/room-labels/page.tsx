import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { branchWhere } from "@/lib/branchScope";
import { getBrand } from "@/lib/brand";
import RoomLabels, { type LabelRoom } from "./RoomLabels";

export const dynamic = "force-dynamic";
export const metadata = { title: "QR yorliqlar", robots: { index: false, follow: false } };

export default async function RoomLabelsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(id ? `/room-labels?id=${id}` : "/room-labels")}`);
  if (!canRead(s.role, MODULES.GROUPS)) redirect("/dashboard");

  const rooms = await prisma.room.findMany({
    where: { AND: [{ isActive: true }, branchWhere(s), ...(id ? [{ id }] : [])] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, capacity: true, branchId: true, responsible: { select: { fullName: true } } },
  });
  const branchIds = [...new Set(rooms.map((r) => r.branchId).filter((b): b is string => !!b))];
  const branches = branchIds.length ? await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [];
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  const host = (await headers()).get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";

  const labels: LabelRoom[] = rooms.map((r) => {
    const url = `${proto}://${host}/r/${r.id}`;
    const q = QRCode.create(url, { errorCorrectionLevel: "H" });
    return {
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      branch: r.branchId ? branchName.get(r.branchId) ?? null : null,
      responsible: r.responsible?.fullName ?? null,
      url,
      modules: Array.from(q.modules.data, (b) => (b ? "1" : "0")).join(""),
      size: q.modules.size,
    };
  });

  const brand = await getBrand();
  return (
    <RoomLabels
      rooms={labels}
      brand={{ name: brand.name, logo: brand.logo, logoDark: brand.logoDark }}
      mark={brand.isMain ? "/logo-mark.png" : ""}
      locale={s.locale}
    />
  );
}
