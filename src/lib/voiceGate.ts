// WAV yozuvida haqiqatan gapirilganmi — ovoz kuchi bo'yicha.
//
// ZARUR DARVOZA. Gemini MUTLAQ JIMLIKKA ham so'z "eshitadi": sinovda toza
// jimlikka "das Fenster, 95%" dedi. Ya'ni modelga yolg'iz ishonib bo'lmaydi
// — jim yozuv unga umuman yuborilmasligi kerak. Shu funksiya so'rovdan
// OLDIN turadi (src/app/api/pronounce/route.ts) va sinov ham aynan shu
// darvozadan o'tkazadi (scripts/test-speech-e2e.ts), shunda sinov haqiqiy
// quvurni aks ettiradi.
//
// Mijozda ham shunday tekshiruv bor (SpeakStage) — u tezkor javob uchun;
// uni chetlab o'tish mumkin, haqiqiy himoya shu yerda.
//
// Neytral modul: server ham, sinov skripti ham import qiladi.

/** 16 kHz, 16-bit, mono WAV kutiladi (SpeakStage shunday yasaydi) */
const SAMPLE_RATE = 16000;
/** 20 ms li bo'lak */
const FRAME = SAMPLE_RATE / 50;
/** Ovoz bor deb hisoblanadigan eng past kuch (~ -34 dB) */
const VOICE_RMS = 0.02;
/** Kamida shuncha bo'lakda ovoz bo'lsin — 250 ms */
const MIN_LOUD_FRAMES = 12;
/**
 * Nol-kesish tezligi (ZCR) baland bo'laklar orasida qanchalik o'zgarishi
 * kerak. Nutqda undosh/unli almashinadi va ZCR kadrdan kadrga kuchli
 * o'zgaradi; toza ohangda u deyarli DOIMIY, oq shovqinda ham doimiy va
 * juda baland. Sinovda model toza 440 Hz ohangga "der Tisch, 100%" dedi —
 * ya'ni faqat balandlik yetmaydi, "nutqqa o'xshashlik" ham kerak.
 */
const MIN_ZCR_SPREAD = 0.02;
/**
 * O'rtacha ZCR ning yuqori chegarasi. Oq shovqinda ZCR ~0.5 (har ikkinchi
 * namuna belgisi almashadi) va sinovda uning tarqalishi tasodifan
 * nutqdagidek chiqdi. Nutqda esa o'rtacha ZCR 0.05–0.25 oralig'ida;
 * 0.35 dan yuqori o'rtacha — bu nutq emas, shovqin.
 */
const MAX_ZCR_MEAN = 0.35;

export function wavHasVoice(buf: Buffer): boolean {
  // "data" bo'lagini topamiz — WAV sarlavhasi doim 44 bayt bo'lavermaydi
  let at = 12;
  let start = 44;
  let size = buf.length - 44;
  while (at + 8 <= buf.length) {
    const id = buf.toString("ascii", at, at + 4);
    const len = buf.readUInt32LE(at + 4);
    if (id === "data") {
      start = at + 8;
      size = Math.min(len, buf.length - start);
      break;
    }
    at += 8 + len + (len % 2);
  }
  if (size <= 0) return false;

  const samples = Math.floor(size / 2);
  let loud = 0;
  let frames = 0;
  /** Baland bo'laklarning ZCR qiymatlari (0..1) — tarqalishini o'lchash uchun */
  const zcrs: number[] = [];

  for (let i = 0; i + FRAME <= samples; i += FRAME) {
    let sum = 0;
    let crossings = 0;
    let prev = buf.readInt16LE(start + i * 2);
    for (let j = 0; j < FRAME; j++) {
      const raw = buf.readInt16LE(start + (i + j) * 2);
      const v = raw / 32768;
      sum += v * v;
      if ((raw >= 0) !== (prev >= 0)) crossings++;
      prev = raw;
    }
    frames++;
    if (Math.sqrt(sum / FRAME) > VOICE_RMS) {
      loud++;
      zcrs.push(crossings / FRAME);
    }
  }
  if (frames === 0 || loud < MIN_LOUD_FRAMES) return false;

  // Nutqqa o'xshashlik: ZCR o'zgaruvchan (ohang emas) va o'rtachasi
  // me'yorda (oq shovqin emas)
  const mean = zcrs.reduce((a, b) => a + b, 0) / zcrs.length;
  const spread = Math.sqrt(zcrs.reduce((a, z) => a + (z - mean) ** 2, 0) / zcrs.length);
  return spread >= MIN_ZCR_SPREAD && mean <= MAX_ZCR_MEAN;
}
