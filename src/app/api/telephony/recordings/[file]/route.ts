import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { telephonyEnv } from "@/lib/asterisk";

export const runtime = "nodejs";

// Qo'ng'iroq yozuvini (.wav) uzatish — Range (206) qo'llab-quvvatlaydi (audio skrab uchun).
//
// Ikki rejim:
//  1) Fayl shu mashinada bor (server deploy) → to'g'ridan-to'g'ri uzatiladi.
//  2) Yo'q (lokal ishlab chiqish) → SSH tunnel orqali server ilovasidan olinadi.
const ALLOWED: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[\w.-]+\.wav$/.test(file)) return new Response("bad name", { status: 400 });

  // Ichki (proksi) so'rov — faqat maxfiy kalit bilan, loopback orqali
  const internalKey = process.env.TELEPHONY_INTERNAL_KEY || "";
  const isInternal = Boolean(internalKey) && req.headers.get("x-internal-key") === internalKey;

  if (!isInternal) {
    const s = await getSession();
    if (!s || !ALLOWED.includes(s.role)) return new Response("forbidden", { status: 403 });
  }

  const dir = path.resolve(telephonyEnv().recordingDir);
  const full = path.join(dir, file);
  if (!full.startsWith(dir + path.sep)) return new Response("bad path", { status: 400 });

  const stat = await fs.promises.stat(full).catch(() => null);

  // ── Mahalliy fayl yo'q → serverdan (tunnel orqali) olib beramiz ──
  if (!stat || !stat.isFile()) {
    const proxy = process.env.RECORDINGS_PROXY;
    if (!proxy || !internalKey) return new Response("not found", { status: 404 });
    try {
      const range = req.headers.get("range");
      const up = await fetch(`${proxy}/api/telephony/recordings/${encodeURIComponent(file)}`, {
        headers: { "x-internal-key": internalKey, ...(range ? { range } : {}) },
        cache: "no-store",
      });
      if (!up.ok || !up.body) return new Response("not found", { status: 404 });
      const h = new Headers();
      for (const k of ["content-type", "content-length", "content-range", "accept-ranges"]) {
        const v = up.headers.get(k);
        if (v) h.set(k, v);
      }
      h.set("Cache-Control", "public, max-age=86400");
      return new Response(up.body, { status: up.status, headers: h });
    } catch {
      return new Response("proxy unavailable", { status: 502 });
    }
  }

  if (stat.size < 100) return new Response("empty recording", { status: 404 });

  const size = stat.size;
  const range = req.headers.get("range");
  let start = 0, end = size - 1, status = 200;
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) { start = parseInt(m[1], 10); end = m[2] ? parseInt(m[2], 10) : size - 1; status = 206; }
  }
  const headers: Record<string, string> = {
    "Content-Type": "audio/wav",
    "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1),
    "Cache-Control": "public, max-age=86400",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;

  const stream = fs.createReadStream(full, { start, end });
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, { status, headers });
}
