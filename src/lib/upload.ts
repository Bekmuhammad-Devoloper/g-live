// Fayl yuklash chegaralari — /api/upload, ilova formalari va nginx
// (client_max_body_size) bir-biriga mos bo'lishi shart.
//
// Ikki rejim bor:
//   • OQIM (video)  — fayl to'g'ridan-to'g'ri diskka yoziladi, xotiraga
//                     tushmaydi. Shuning uchun katta chegara mumkin.
//   • MULTIPART     — formData() butun faylni xotiraga oladi (Next.js shunday
//                     ishlaydi). Rasm/PDF uchun yetarli, video uchun EMAS.
//
// 2026-09-11: 300 MB -> 5 GB (video darslar uchun). Faqat raqamni ko'tarish
// ishlamasdi — multipart 5 GB ni 2 marta xotiraga olib serverni yiqitardi.

/** Oqim rejimi (video) — MB */
export const MAX_UPLOAD_MB = 5 * 1024; // 5 GB
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Multipart rejimi (rasm, PDF, hujjat) — xotiraga bemalol sig'adigan hajm */
export const MAX_FORM_UPLOAD_MB = 300;
export const MAX_FORM_UPLOAD_BYTES = MAX_FORM_UPLOAD_MB * 1024 * 1024;

/** Chegarani odam o'qiydigan ko'rinishda: 5120 -> "5 GB", 300 -> "300 MB" */
export function formatUploadLimit(mb: number): string {
  return mb >= 1024 && mb % 1024 === 0 ? `${mb / 1024} GB` : `${mb} MB`;
}
