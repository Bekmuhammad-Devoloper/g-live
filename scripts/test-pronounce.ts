// lib/pronounce.ts qoidalarini sinaydi.
//
//   npx tsx scripts/test-pronounce.ts
//
// NEGA KERAK. Talaffuz bosqichida "to'g'ri aytdimi" degan qarorni model
// EMAS, shu modul qabul qiladi (sababi lib/pronounce.ts izohida). Demak
// mashqning adolatliligi shu qoidalarga bog'liq: juda qattiq bo'lsa
// to'g'ri aytgan o'quvchi o'ta olmaydi, juda yumshoq bo'lsa boshqa so'z
// aytilsa ham o'tib ketadi. Ikkala chekka ham shu yerda ushlanadi.

import { checkPronunciation } from "../src/lib/pronounce";

const LESSON = [
  "der Hund", "die Katze", "das Haus", "der Tisch", "die Tür",
  "das Fenster", "der Apfel", "die Milch", "das Buch", "die Schule",
];

/** [maqsad so'z, model eshitgani, qabul qilinishi kerakmi, izoh] */
const CASES: [string, string, boolean, string][] = [
  ["der Hund", "Hund", true, "artiklsiz aytdi"],
  ["der Hund", "der Hund", true, "artikli bilan"],
  ["der Hund", "Der Hund.", true, "bosh harf va nuqta"],
  ["der Hund", "ein Hund", true, "noaniq artikl"],
  ["der Hund", "das ist der Hund", true, "gap ichida aytdi"],
  ["der Hund", "Hunt", true, "transkripsiya bir harfda sirpandi"],
  ["der Hund", "Katze", false, "darsdagi BOSHQA so'z"],
  ["der Hund", "die Katze", false, "darsdagi boshqa so'z, artikli bilan"],
  ["der Hund", "", false, "jimlik"],
  ["der Hund", "Guten Tag", false, "butunlay boshqa narsa"],
  ["das Fenster", "Fenster", true, "to'g'ri"],
  ["das Fenster", "fenstar", true, "uzun so'zda bitta harf"],
  ["das Fenster", "Fensterbank", false, "boshqa, uzunroq so'z"],
  ["die Tür", "Tür", true, "to'g'ri"],
  ["die Tür", "Tur", true, "umlautsiz aytdi"],
  ["die Tür", "Tier", false, "ikki harf farq, qisqa so'z"],
  ["die Schule", "die schule", true, "kichik harflarda"],
  ["der Apfel", "Apfel", true, "to'g'ri"],
  ["der Apfel", "Ampel", false, "ikki harf farq"],
  ["das Haus", "Haus", true, "to'g'ri"],
  ["das Buch", "Bus", false, "ikki harf farq"],
  ["die Milch", "Milch bitte", true, "ortiqcha so'z bilan"],
];

let bad = 0;
for (const [target, heard, want, note] of CASES) {
  const others = LESSON.filter((w) => w !== target);
  const got = checkPronunciation(target, heard, others);
  if (got.ok !== want) {
    bad++;
    console.error(
      `XATO  "${target}" <- "${heard}"  (${note})\n` +
      `      kutilgan=${want}  chiqdi=${got.ok}  eng yaqin="${got.matched}"`,
    );
  }
}

console.log(
  bad === 0
    ? `OK — ${CASES.length} ta holat, hammasi kutilganidek`
    : `${bad}/${CASES.length} holat mos kelmadi`,
);
process.exit(bad === 0 ? 0 : 1);
