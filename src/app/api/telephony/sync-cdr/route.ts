import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Qo'ng'iroqlar sahifasidagi "Yangilash" tugmasi shu yerni chaqiradi.
// Asterisk CDR — qo'ng'iroqlarning to'liq va ishonchli manbasi: ami-worker
// ishlamay qolgan paytdagi qo'ng'iroqlar ham shu orqali bazaga tushadi.
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

  // Bir vaqtda faqat bitta sinxronizatsiya — tugma tez bosilsa ham
  if (!running) {
    running = runSync().finally(() => { running = null; });
  }

  try {
    const out = await running;
    // "jami 36, yangi 35, ..." dan sonlarni ajratamiz
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
