import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { APK_DIR, APK_FILE } from "@/lib/appRelease";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Android ilovasini yuklab berish.
// Fayl repozitoriyda emas — serverda /opt/gl-edu/apk/ papkasida turadi,
// shu sabab uni public/ orqali emas, shu yo'l orqali beramiz.

export async function GET() {
  const file = path.join(APK_DIR, APK_FILE);
  let size: number;
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error("not_a_file");
    size = st.size;
  } catch {
    return new NextResponse("Ilova hali tayyor emas", { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${APK_FILE}"`,
      "Cache-Control": "no-cache",
    },
  });
}
