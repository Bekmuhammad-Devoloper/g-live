import { headers } from "next/headers";
import { readRegistry } from "@/lib/devpanel/registry";
import { readSales } from "@/lib/devpanel/sales";
import { isOpenStatus } from "@/lib/devpanel/salesTypes";
import { fmtMoney, Stat } from "../ui";
import SalesWorkspace from "./SalesWorkspace";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [sales, reg, h] = await Promise.all([readSales(), readRegistry(), headers()]);
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${h.get("host") ?? "dev.germaniya.live"}`;

  const live = reg.centers.filter((c) => c.status === "active" && !c.suspended);
  const priceOf = new Map(sales.plans.map((p) => [p.name.toLowerCase(), p.price ?? 0]));
  const monthly = live.reduce((sum, c) => sum + (priceOf.get(c.plan.toLowerCase()) ?? 0), 0);
  const unpriced = live.filter((c) => !priceOf.get(c.plan.toLowerCase())).length;

  const fresh = sales.leads.filter((l) => l.status === "NEW").length;
  const open = sales.leads.filter((l) => isOpenStatus(l.status)).length;
  const won = sales.leads.filter((l) => l.status === "WON").length;
  const rate = sales.leads.length ? Math.round((won / sales.leads.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Obuna lidlari</h1>
        <p className="mt-1 text-sm text-slate-500">O'quv markazlaridan tushgan arizalar va sotuv jarayoni</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <div><Stat label="Yangi lidlar" value={fresh} tone={fresh ? "blue" : "slate"} icon="lead" hint="Bog'lanish kutilmoqda" /></div>
        <div><Stat label="Jarayonda" value={open} icon="activity" hint={`Jami lid: ${sales.leads.length}`} /></div>
        <div><Stat label="Sotildi" value={won} tone={won ? "green" : "slate"} icon="building" hint={`Konversiya: ${rate}%`} /></div>
        <div>
          <Stat
            label="Oylik obuna"
            value={fmtMoney(monthly)}
            tone={monthly ? "green" : "slate"}
            icon="money"
            hint={unpriced ? `${live.length} ta markaz, ${unpriced} tasining tarifida narx yo'q` : `${live.length} ta faol markaz bo'yicha`}
          />
        </div>
      </div>
      <SalesWorkspace leads={sales.leads} links={sales.links} plans={sales.plans} origin={origin} />
    </div>
  );
}
