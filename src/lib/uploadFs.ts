import "server-only";
import path from "node:path";

// Yuklangan fayllar diskda qayerda va qanday nomlanadi — /api/upload va
// /api/upload/session ikkalasi shu qoidadan foydalanadi.

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Tugallanmagan bo'lakli yuklashlar. ATAYLAB public/ TASHQARISIDA: Next
 * server ishga tushganda public/ ni to'liq (nuqtali papkalar bilan) o'qiydi
 * va /uploads/:name rewrite'i faqat bitta segmentni qamraydi — public ichida
 * tursa deploy'dan keyin yarim fayllar va meta.json (egasining id'si)
 * autentifikatsiyasiz ochilib qolardi. Xuddi shu diskda (rename nusxasiz).
 * update-b.sh dagi `git reset --hard` kuzatilmaydigan papkaga tegmaydi.
 */
export const PARTS_DIR = path.join(process.cwd(), "upload-parts");

const EXT: Record<string, string> = {
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-matroska": "mkv", "video/ogg": "ogv",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/pdf": "pdf",
  // Hujjatlar — lug'at va topshiriq fayllari
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "application/rtf": "rtf",
};

/** Kengaytmani MIME yoki fayl nomidan aniqlaymiz */
export function extFor(mime: string, name: string): string {
  const nameExt = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return EXT[mime.split(";")[0].trim()] || (nameExt && nameExt.length <= 5 ? nameExt : "bin");
}
