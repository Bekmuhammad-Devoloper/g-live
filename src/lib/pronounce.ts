import { splitArticle } from "./lessonWords";

// Talaffuz mashqi: eshitilgan matn maqsad so'zga to'g'ri keladimi.
//
// NEGA BU YERDA, MODELDA EMAS. Sinovda Gemini'dan "shu so'zni to'g'ri
// aytdimi?" deb so'ralganda u so'rovdagi maqsad so'zga QARAB rozi bo'lib
// ketardi: oddiy ohangga ham, tasodifiy shovqinga ham "Hund dedi, to'g'ri"
// deb javob berdi. Ya'ni mashq har qanday tovushni o'tkazib yuborardi.
//
// Shu sabab vazifa ikkiga bo'lindi:
//   · model FAQAT eshitganini yozadi (maqsad so'z unga umuman aytilmaydi,
//     shuning uchun rozi bo'lishga sabab ham yo'q)
//   · solishtirishni esa mana shu qat'iy qoidalar bajaradi
//
// Bu, qo'shimcha ravishda, sinovdan o'tkazsa bo'ladigan kod: qaysi javob
// qabul qilinishini modelning kayfiyati emas, quyidagi qoidalar belgilaydi.

/** Artikllar — o'quvchi "Hund" desa ham, "der Hund" desa ham to'g'ri */
const ARTICLES = new Set([
  "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einen", "einem", "einer", "eines",
]);

/** Tinish belgilarini olib tashlaydi, kichik harfga o'tkazadi.
 *  `|` ham ajratkich: Androidning nutq tanish tizimi bir nechta variant
 *  qaytaradi va ular shu belgi bilan ulanadi. */
export function normalizeSpeech(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'`´()[\]{}…—–\-_/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein masofasi — transkripsiyadagi kichik xatolarga chidash uchun */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,          // o'chirish
        cur[j - 1] + 1,       // qo'shish
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // almashtirish
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Umlaut va ß ni oddiy harflarga keltiradi: ä→a, ö→o, ü→u, ß→ss.
 *
 * Nutq tanish tizimi "Tür" ni ko'pincha "Tur" deb yozadi — bu BOSHQA so'z
 * emas, o'sha so'zning umlautsiz yozilishi. Shu farq solishtirishdan
 * oldin yo'qotiladi, aks holda to'g'ri aytgan o'quvchi xato hisoblanardi.
 */
export function foldUmlauts(s: string): string {
  return s
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Qanchalik chetlanishga yo'l qo'yamiz.
 *
 * Nol bo'lsa transkripsiyaning kichik sirpanishi ham to'g'ri javobni rad
 * etardi ("Hund" nemis tilida [hunt] deb aytiladi va ko'pincha "Hunt" deb
 * yoziladi). Juda katta bo'lsa boshqa so'z o'tib ketardi.
 */
const tolerance = (len: number) => (len >= 8 ? 2 : 1);

export interface PronounceResult {
  ok: boolean;
  /** Solishtirishda ishlatilgan, tozalangan maqsad so'z */
  target: string;
  /** Eshitilgan matndan ajratilgan eng yaqin so'z (o'quvchiga ko'rsatiladi) */
  matched: string | null;
}

/**
 * @param targetDe   dars lug'atidagi so'z, artikli bilan ("der Hund")
 * @param transcript modelning eshitgani ("das ist ein hund")
 * @param others     darsdagi QOLGAN so'zlar — boshqa so'z aytilganini
 *                   aniq ajratish uchun
 */
export function checkPronunciation(
  targetDe: string,
  transcript: string,
  others: string[] = [],
): PronounceResult {
  const target = normalizeSpeech(splitArticle(targetDe).rest);
  const said = normalizeSpeech(transcript);
  if (!target || !said) return { ok: false, target, matched: null };

  const goal = foldUmlauts(target);

  // Boshqa so'zlarning o'zaklari — aynan shular aytilgan bo'lsa xato
  const rivals = new Set(
    others
      .map((w) => foldUmlauts(normalizeSpeech(splitArticle(w).rest)))
      .filter((w) => w && w !== goal),
  );

  // Artikllarni tashlab, so'zlarga ajratamiz. Butun ibora ham nomzod:
  // "kühlschrank" bitta so'z, lekin model uni ikkiga bo'lib yozishi mumkin.
  const tokens = said.split(" ").filter((w) => w && !ARTICLES.has(w));
  const candidates = [said.replace(/\s+/g, ""), ...tokens];

  const tol = tolerance(goal.length);
  let best: { word: string; folded: string; d: number } | null = null;

  for (const c of candidates) {
    if (!c) continue;
    const folded = foldUmlauts(c);
    const d = editDistance(folded, goal);
    if (!best || d < best.d) best = { word: c, folded, d };
  }
  if (!best) return { ok: false, target, matched: null };

  // Eshitilgani darsdagi boshqa so'zga AYNAN to'g'ri kelsa — boshqa so'z
  // aytilgan, chetlanishga yo'l qo'yilmaydi.
  const saidARival = candidates.some((c) => rivals.has(foldUmlauts(c)));

  // BIRINCHI HARF mos kelishi shart.
  //
  // Chetlanish transkripsiyaning kichik sirpanishini kechirish uchun, so'z
  // almashtirish uchun emas. Nemis tilida so'z OXIRIDAGI jarangsizlanish
  // ("Hund" -> [hunt]) tabiiy va kechiriladi; so'z BOSHIDAGI farq esa
  // boshqa so'z demakdir — "Tisch" va "Fisch", "Haus" va "Maus" orasi ham
  // bir harf, lekin ular butunlay boshqa so'zlar va ularni qabul qilish
  // mashqni ma'nosiz qilardi.
  const sameStart = best.folded.charAt(0) === goal.charAt(0);

  return {
    ok: best.d === 0 || (!saidARival && sameStart && best.d <= tol),
    target,
    matched: best.word || null,
  };
}
