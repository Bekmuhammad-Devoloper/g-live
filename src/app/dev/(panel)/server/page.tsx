import { sysInfo } from "@/lib/devpanel/ops";
import { Card, Pill, fmtBytes, fmtDate, fmtDuration, fmtDateTime, Bar } from "../ui";

export const dynamic = "force-dynamic";

const SERVICE_LABEL: Record<string, string> = {
  "gl-edu": "Germaniya Live (asosiy sayt)",
  "gl-ami": "Qo'ng'iroqlar kuzatuvchisi (AMI)",
  "gl-tunnel": "Telefoniya tunneli",
  "gl-cdr.timer": "Qo'ng'iroq tarixi sinxroni",
  "gl-dev": "Dev panel",
  nginx: "Nginx (veb-server)",
  "gl-centers-backup.timer": "Markazlar zaxirasi (har kecha)",
  docker: "Docker",
  "certbot.timer": "SSL avtomatik yangilash",
};

export default async function ServerPage() {
  const s = await sysInfo();
  const memTotal = +s.kv.mem_total || 0;
  const memUsed = memTotal - (+s.kv.mem_available || 0);
  const root = s.disks.find((d) => d.mount === "/") ?? s.disks[0];
  const cpu = +s.kv.cpu_pct || 0;
  const cores = +s.kv.cpu_cores || 1;
  const load = (s.kv.load ?? "").split(" ").map(Number);
  const [deployHash, deployAt, deployMsg] = (s.kv.last_deploy ?? "").split("~");
  const now = Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Server</h1>
        <p className="mt-1 text-sm text-slate-400">{s.kv.hostname} · {s.kv.ip} · ishlayapti {fmtDuration(+s.kv.uptime_s || 0)}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Protsessor</div>
          <div className="mt-1.5 text-2xl font-bold">{cpu}%</div>
          <Bar pct={cpu} />
          <div className="mt-2 text-xs text-slate-400">{cores} yadro · yuklama {load.map((x) => x.toFixed(2)).join(" / ")} (1/5/15 daq)</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{s.kv.cpu_model}</div>
        </Card>
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Xotira</div>
          <div className="mt-1.5 text-2xl font-bold">{memTotal ? Math.round((memUsed / memTotal) * 100) : 0}%</div>
          <Bar pct={memTotal ? (memUsed / memTotal) * 100 : 0} />
          <div className="mt-2 text-xs text-slate-400">{fmtBytes(memUsed)} band · {fmtBytes(+s.kv.mem_available || 0)} bo'sh · jami {fmtBytes(memTotal)}</div>
          <div className="mt-0.5 text-xs text-slate-500">Swap: {+s.kv.swap_total ? `${fmtBytes(+s.kv.swap_used)} / ${fmtBytes(+s.kv.swap_total)}` : "yo'q"}</div>
        </Card>
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Disk (/)</div>
          <div className="mt-1.5 text-2xl font-bold">{root ? Math.round((root.used / root.size) * 100) : 0}%</div>
          <Bar pct={root ? (root.used / root.size) * 100 : 0} />
          <div className="mt-2 text-xs text-slate-400">{root ? `${fmtBytes(root.used)} band · ${fmtBytes(root.avail)} bo'sh · jami ${fmtBytes(root.size)}` : "—"}</div>
          <div className="mt-0.5 text-xs text-slate-500">{s.disks.filter((d) => d.mount !== "/").map((d) => `${d.mount} ${Math.round((d.used / d.size) * 100)}%`).join(" · ")}</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Tizim</h2>
          <dl className="grid grid-cols-[150px_1fr] gap-y-2 text-sm">
            <dt className="text-slate-400">Operatsion tizim</dt><dd>{s.kv.os}</dd>
            <dt className="text-slate-400">Yadro</dt><dd className="font-mono text-xs">{s.kv.kernel}</dd>
            <dt className="text-slate-400">Node.js</dt><dd className="font-mono text-xs">{s.kv.node}</dd>
            <dt className="text-slate-400">Nginx</dt><dd className="font-mono text-xs">{s.kv.nginx}</dd>
            <dt className="text-slate-400">Ochiq portlar</dt><dd className="font-mono text-xs">{s.kv.ports}</dd>
            <dt className="text-slate-400">Oxirgi deploy</dt>
            <dd><span className="font-mono text-xs">{deployHash}</span> · {fmtDateTime(deployAt)}<div className="text-xs text-slate-500">{deployMsg}</div></dd>
            <dt className="text-slate-400">Markazlar zaxirasi</dt>
            <dd>oxirgi {fmtDateTime(s.backupTimer.last)} · keyingi {fmtDateTime(s.backupTimer.next)}</dd>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">SSL sertifikatlar</h2>
          <ul className="space-y-2 text-sm">
            {s.certs.map((c) => {
              const days = c.expires ? Math.floor((new Date(c.expires).getTime() - now) / 86_400_000) : null;
              return (
                <li key={c.name} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-mono text-xs">{c.domains.join(", ") || c.name}</span>
                  {days === null ? <Pill tone="slate">?</Pill> : days < 0 ? <Pill tone="red">Muddati o'tgan</Pill> : days <= 14 ? <Pill tone="amber">{days} kun</Pill> : <Pill tone="green">{fmtDate(c.expires)} · {days} kun</Pill>}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Sertifikatlar certbot taymeri orqali muddatidan 30 kun oldin avtomatik yangilanadi.</p>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <h2 className="px-5 pt-5 font-semibold">Xizmatlar</h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[720px] text-sm">
            <thead className="bg-white/[0.03] text-left text-xs font-semibold uppercase text-slate-400">
              <tr><th className="px-5 py-2.5">Xizmat</th><th className="px-5 py-2.5">Holat</th><th className="px-5 py-2.5">Ishlayapti</th><th className="px-5 py-2.5 text-right">Xotira</th><th className="px-5 py-2.5 text-right">Qayta ishga tushgan</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {s.services.map((v) => (
                <tr key={v.name}>
                  <td className="px-5 py-2.5"><div>{SERVICE_LABEL[v.name] ?? v.name.replace(/^gl-center@(.+)\.service$/, "Markaz: $1")}</div><div className="font-mono text-[11px] text-slate-500">{v.name}</div></td>
                  <td className="px-5 py-2.5">{v.active === "active" ? <Pill tone="green">● Faol</Pill> : <Pill tone="red">● {v.active}</Pill>}</td>
                  <td className="px-5 py-2.5 text-slate-400">{v.since ? fmtDuration((now - new Date(v.since).getTime()) / 1000) : "—"}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-slate-300">{v.memBytes ? fmtBytes(v.memBytes) : "—"}</td>
                  <td className={`px-5 py-2.5 text-right tabular-nums ${v.restarts > 0 ? "text-amber-400" : "text-slate-500"}`}>{v.restarts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="!p-0 overflow-hidden">
          <h2 className="px-5 pt-5 font-semibold">Eng ko'p xotira olayotgan jarayonlar</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-white/[0.06]">
              {s.procs.map((p) => (
                <tr key={p.pid}>
                  <td className="max-w-[260px] truncate px-5 py-2 font-mono text-[11px] text-slate-300" title={p.cmd}>{p.cmd}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">{p.cpu}%</td>
                  <td className="px-5 py-2 text-right tabular-nums">{fmtBytes(p.rss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="!p-0 overflow-hidden">
          <h2 className="px-5 pt-5 font-semibold">Serverdagi boshqa loyihalar (Docker)</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-white/[0.06]">
              {s.docker.length === 0 && <tr><td className="px-5 py-4 text-slate-500">Konteyner yo'q</td></tr>}
              {s.docker.map((d) => (
                <tr key={d.name}>
                  <td className="px-5 py-2"><div className="font-mono text-xs">{d.name}</div><div className="truncate text-[11px] text-slate-500">{d.image}</div></td>
                  <td className="px-5 py-2 text-right">{d.status.startsWith("Up") ? <Pill tone="green">{d.status.replace(/^Up /, "")}</Pill> : <Pill tone="red">{d.status}</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
