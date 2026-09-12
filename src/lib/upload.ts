// Fayl yuklash chegaralari — /api/upload, ilova formalari va nginx
// (client_max_body_size) bir-biriga mos bo'lishi shart.
//
// Uch rejim bor:
//   • BO'LAKLI (video, katta fayl) — fayl 4–16 MB bo'laklarga bo'linib,
//     bir nechtasi PARALLEL yuboriladi; uzilgan bo'lak qayta yuboriladi,
//     sahifa yangilansa ham davom etadi. Telefon tarmog'ida bitta uzun
//     so'rov "qotib" qolardi — shu rejim o'shani yechadi (lib/chunkedUpload.ts).
//   • OQIM (bitta so'rov) — fayl to'g'ridan-to'g'ri diskka yoziladi,
//     xotiraga tushmaydi. Kichik fayllar va eski mijozlar uchun qoladi.
//   • MULTIPART — formData() butun faylni xotiraga oladi (Next.js shunday
//     ishlaydi). Rasm/PDF uchun yetarli, video uchun EMAS.
//
// 2026-09-11: 300 MB -> 5 GB (video darslar uchun). Faqat raqamni ko'tarish
// ishlamasdi — multipart 5 GB ni 2 marta xotiraga olib serverni yiqitardi.
// 2026-09-12: bo'lakli rejim — telefonda 19% da qotib qolish va sekinlik.

/** Oqim/bo'lakli rejim (video) — MB */
export const MAX_UPLOAD_MB = 5 * 1024; // 5 GB
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Multipart rejimi (rasm, PDF, hujjat) — xotiraga bemalol sig'adigan hajm */
export const MAX_FORM_UPLOAD_MB = 300;
export const MAX_FORM_UPLOAD_BYTES = MAX_FORM_UPLOAD_MB * 1024 * 1024;

/** Shu hajmdan katta fayl bo'lakli rejimda yuboriladi */
export const CHUNKED_FROM_BYTES = 8 * 1024 * 1024;

/** Bo'lak hajmi chegaralari — server ham, mijoz ham shuni tekshiradi */
export const MIN_CHUNK_BYTES = 1 * 1024 * 1024;
export const MAX_CHUNK_BYTES = 32 * 1024 * 1024;

/**
 * Fayl hajmiga qarab bo'lak hajmi. Kichik bo'lak — sekin tarmoqda uzilsa
 * kam yo'qotiladi; katta bo'lak — so'rovlar soni kam. 5 GB / 16 MB = 320 bo'lak.
 */
export function chunkSizeFor(size: number): number {
  if (size <= 64 * 1024 * 1024) return 4 * 1024 * 1024;
  if (size <= 512 * 1024 * 1024) return 8 * 1024 * 1024;
  return 16 * 1024 * 1024;
}

/** Tugallanmagan bo'lakli yuklash shuncha vaqtdan keyin o'chiriladi */
export const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Chegarani odam o'qiydigan ko'rinishda: 5120 -> "5 GB", 300 -> "300 MB" */
export function formatUploadLimit(mb: number): string {
  return mb >= 1024 && mb % 1024 === 0 ? `${mb / 1024} GB` : `${mb} MB`;
}
