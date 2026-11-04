import { BASE_DOMAIN } from "@/lib/devpanel/registry";
import { readSales } from "@/lib/devpanel/sales";
import { formatPhone } from "@/lib/devpanel/salesTypes";
import { INSTANCE_MODULES, ALL_INSTANCE_MODULES } from "@/lib/instance";
import NewCenterForm from "./NewCenterForm";

export default async function NewCenterPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: leadId } = await searchParams;
  const sales = await readSales();
  const lead = leadId ? sales.leads.find((l) => l.id === leadId) ?? null : null;
  const initial = lead ? {
    leadId: lead.id, name: lead.centerName, directorName: lead.contactName, directorPhone: formatPhone(lead.phone),
    contactName: lead.contactName, contactPhone: formatPhone(lead.phone), plan: lead.planName ?? "", notes: lead.note,
  } : undefined;
  const modules = ALL_INSTANCE_MODULES.map((k) => ({ key: k, name: INSTANCE_MODULES[k].uz, desc: INSTANCE_MODULES[k].desc }));
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Yangi o'quv markazi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Markaz o'z bazasi, fayllari va <span className="font-mono">nomi.{BASE_DOMAIN}</span> manzili bilan alohida ishga tushadi. Yaratish 1–2 daqiqa oladi.
      </p>
      <NewCenterForm baseDomain={BASE_DOMAIN} modules={modules} plans={sales.plans.map((p) => p.name)} initial={initial} />
    </div>
  );
}
