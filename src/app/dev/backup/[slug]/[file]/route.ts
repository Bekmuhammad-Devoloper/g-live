import { NextResponse } from "next/server";
import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { getDevSession, devAudit } from "@/lib/devpanel/auth";
import { centerDir } from "@/lib/devpanel/registry";

// Markaz bazasining zaxira nusxasini yuklab olish — faqat Dev panelga kirgan foydalanuvchi
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; file: string }> }) {
  const dev = await getDevSession();
  if (!dev) return new NextResponse("unauthorized", { status: 401 });
  const { slug, file } = await ctx.params;
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug) || !/^db-\d{8}-\d{6}\.sqlite$/.test(file)) return new NextResponse("bad_name", { status: 400 });
  const full = path.join(centerDir(slug), "backups", file);
  let size = 0;
  try { size = (await fs.stat(full)).size; } catch { return new NextResponse("not_found", { status: 404 }); }
  await devAudit("backup_download", { by: dev.email, slug, file });
  return new NextResponse(Readable.toWeb(createReadStream(full)) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${slug}-${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
