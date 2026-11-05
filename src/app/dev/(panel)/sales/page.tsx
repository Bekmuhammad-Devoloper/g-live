import { readRegistry } from "@/lib/devpanel/registry";
import { readSales } from "@/lib/devpanel/sales";
import { fmtMoney } from "../ui";
import SalesWorkspace from "./SalesWorkspace";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [sales, reg] = await Promise.all([readSales(), readRegistry()]);

  const live = reg.centers.filter((c) => c.status === "active" && !c.suspended);
  const priceOf = new Map(sales.plans.map((p) => [p.name.toLowerCase(), p.price ?? 0]));
  const monthly = live.reduce((sum, c) => sum + (priceOf.get(c.plan.toLowerCase()) ?? 0), 0);

  const won = sales.leads.filter((l) => l.status === "WON").length;
  const rate = sales.leads.length ? Math.round((won / sales.leads.length) * 100) : 0;
  const summary = `Konversiya: ${rate}% · Oylik obuna: ${fmtMoney(monthly)} · Faol markaz: ${live.length}`;

  return <SalesWorkspace leads={sales.leads} links={sales.links} plans={sales.plans} summary={summary} />;
}
