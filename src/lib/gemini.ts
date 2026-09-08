import "server-only";

// Talaffuz tekshiruvi uchun Gemini — ILOVA KODI shu fayl orqali murojaat
// qiladi.
//
// Haqiqiy mantiq lib/transcribe.ts da va u ATAYLAB neytral: shundagina uni
// Next'dan tashqarida, haqiqiy nemis nutqi bilan sinovdan o'tkazsa bo'ladi
// (scripts/test-speech-e2e.ts). "server-only" esa shu yerda turadi va
// modul tasodifan mijoz komponentidan chaqirilsa build'ni to'xtatadi.

export { transcribeAudio, isGeminiConfigured, type Transcript } from "./transcribe";
