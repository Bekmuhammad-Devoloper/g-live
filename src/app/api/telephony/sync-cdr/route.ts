import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let running: Promise<string> | null = null;

function runSync(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["--env-file=.env", path.join(process.cwd(), "scripts", "sync-cdr.mjs")],
      { cwd: process.cwd(), timeout: 90_000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(String(stderr || err.message).slice(0, 300)));
        else resolve(String(stdout).trim());
      },
    );
  });
}

export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!running) {
    running = runSync().finally(() => { running = null; });
  }

  try {
    const out = await running;
    const created = Number(/yangi (\d+)/.exec(out)?.[1] ?? 0);
    const updated = Number(/yangilandi (\d+)/.exec(out)?.[1] ?? 0);
    return NextResponse.json({ ok: true, created, updated, message: out }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const message = /Permission denied|publickey|Host key|ssh:/i.test(raw)
      ? "Serverga ulanib bo'lmadi (SSH kalitini tekshiring)"
      : /timeout|ETIMEDOUT|ConnectTimeout/i.test(raw)
        ? "Server javob bermadi — internet aloqasini tekshiring"
        : raw || "Sinxronizatsiya amalga oshmadi";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
