import "server-only";

// Talaffuz tekshiruvi uchun Gemini — ILOVA KODI shu fayl orqali murojaat
// qiladi. Haqiqiy mantiq lib/transcribe.ts da va u ATAYLAB neytral:
// Next'dan tashqarida sinash mumkin bo'lsin. "server-only" shu yerda —
// modul tasodifan mijoz komponentidan chaqirilsa build to'xtaydi.

export { recognizeWord, isGeminiConfigured, type Recognition, type RecognizeResult } from "./transcribe";
