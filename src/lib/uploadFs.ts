import "server-only";
import path from "node:path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

export const PARTS_DIR = process.env.UPLOAD_PARTS_DIR || path.join(process.cwd(), "upload-parts");

const EXT: Record<string, string> = {
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-matroska": "mkv", "video/ogg": "ogv",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "application/rtf": "rtf",
};

export function extFor(mime: string, name: string): string {
  const nameExt = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return EXT[mime.split(";")[0].trim()] || (nameExt && nameExt.length <= 5 ? nameExt : "bin");
}
