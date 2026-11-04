import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readSales } from "@/lib/devpanel/sales";
import Landing from "../Landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Germaniya Live CRM — o'quv markazlari uchun obuna",
  description: "Lidlar, guruhlar, davomat, to'lovlar va oylik hisobi uchun tayyor CRM.",
};

export default async function SalesLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sales = await readSales();
  const link = sales.links.find((l) => l.code === code && l.active);
  if (!link) notFound();
  return <Landing code={link.code} plans={sales.plans.filter((p) => p.visible)} />;
}
