import { BASE_DOMAIN } from "@/lib/devpanel/registry";
import { INSTANCE_MODULES, ALL_INSTANCE_MODULES } from "@/lib/instance";
import NewCenterForm from "./NewCenterForm";

export default function NewCenterPage() {
  const modules = ALL_INSTANCE_MODULES.map((k) => ({ key: k, name: INSTANCE_MODULES[k].uz, desc: INSTANCE_MODULES[k].desc }));
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Yangi o'quv markazi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Markaz o'z bazasi, fayllari va <span className="font-mono">nomi.{BASE_DOMAIN}</span> manzili bilan alohida ishga tushadi. Yaratish 1–2 daqiqa oladi.
      </p>
      <NewCenterForm baseDomain={BASE_DOMAIN} modules={modules} />
    </div>
  );
}
