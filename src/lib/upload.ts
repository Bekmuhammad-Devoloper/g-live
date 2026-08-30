// Fayl yuklash chegarasi — /api/upload, ilova formalari va nginx
// (client_max_body_size) bir xil qiymatda bo'lishi shart.
export const MAX_UPLOAD_MB = 300;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
