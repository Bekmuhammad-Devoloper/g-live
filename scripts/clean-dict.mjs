/**
 * Lug'at bazasini oxirgi marta tozalaydi (src/data/dict-de-uz.json).
 *
 * Baza bosma "Nemischa-o'zbekcha lug'at" skanidan OCR orqali olingan, shu
 * sabab tarjima matnining boshiga grammatik shakl qoldiqlari ("-(e)s, er"),
 * so'z turkumi belgilari ("vt", "v/") va OCR shovqini yopishib qolgan.
 * Bu skript o'sha qoldiqlarni kesib, kerakli maydonlarga ko'chiradi.
 *
 *   node scripts/clean-dict.mjs           — natijani ko'rsatadi
 *   node scripts/clean-dict.mjs --apply   — faylni yangilaydi
 */
import fs from "node:fs";

const FILE = "src/data/dict-de-uz.json";
const apply = process.argv.includes("--apply");

const POS = { vt: "vt", vi: "vi", adj: "adj", adv: "adv", "v/": "vt", num: "num", pron: "pron", konj: "konj", int: "int" };
// Aniq OCR xatolari (avtomatik qoida bilan tuzatib bo'lmaydiganlari)
const TYPOS = [
  [/\bmchnat/g, "mehnat"],
  [/\bchtiyoj/g, "ehtiyoj"],
  [/\bchtibor/g, "e'tibor"],
  [/\bchtiyot/g, "ehtiyot"],
];

const hasWord = (t) => /[A-Za-zÄÖÜäöüß']{3,}/.test(t);

const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
let movedGram = 0, movedPos = 0, dropped = 0, typos = 0;

// Manba nashri A–L harflarini qamraydi ("lackieren" so'zida tugaydi).
// M–Z ga tushib qolgan yozuvlar — qator noto'g'ri bo'lingan OCR chiqindisi.
const inRange = (e) => e.l >= "A" && e.l <= "L" && e.l.length === 1;
// Sarlavha nemischa bo'lishi shart: o'zbekcha "q", apostrof yoki -moq/-lik yo'q
const isGerman = (de) =>
  !/['`]/.test(de) && !/q(?!u)/i.test(de) && !(de[0] === de[0].toLowerCase() && /(moq|lik|ish|gan|chi|dan)$/.test(de));

const out = [];
let offRange = 0;
for (const e of data) {
  if (!inRange(e) || !isGerman(e.de)) {
    offRange++;
    continue;
  }
  let uz = e.uz;
  let gram = e.f;
  let pos = e.p;

  // 1) Boshidagi grammatik qoldiqlar: "'-," "-(e)s," "er" "??," ...
  for (let i = 0; i < 4; i++) {
    const m = uz.match(/^(\S+)\s+(?=\S)/);
    if (!m || hasWord(m[1])) break;
    const tok = m[1];
    if (/^\d+[).]$/.test(tok)) break; // "1)" — ma'no raqami, tegilmaydi
    const letters = (tok.match(/[A-Za-zÄÖÜäöüß]/g) ?? []).length;
    const punctOnly = !/[A-Za-zÄÖÜäöüß]/.test(tok);
    if (!punctOnly && !(/[-–—/()]/.test(tok) && letters <= 3)) break;
    uz = uz.slice(m[0].length);
    const t = tok.replace(/[?"]+/g, "").replace(/c\b/g, "e");
    if (/[a-z(]/.test(t) && !gram) gram = t.replace(/^[/'"]+/, "").replace(/[,;]$/, "") || null;
    movedGram++;
  }
  // Ba'zan qoldiq bitta bo'lakda: "er tasvir" -> "er" ham tashlanadi
  {
    const m = uz.match(/^(e[nrs]|s|n)\s+(?=[a-zA-ZÄÖÜäöüß])/);
    if (m && gram && !gram.includes(m[1])) {
      gram = gram + ", -" + m[1];
      uz = uz.slice(m[0].length);
    }
  }
  // "ses, Häuser 1) uy..." — ma'no raqamidan oldingi nemischa shakl bloki
  {
    const m = uz.match(/^((?:\(e\)|[esnr]){1,4}[,;]?\s+(?:[-–—]{0,2}[A-ZÄÖÜ][a-zäöüß]{2,}\s+)?)(?=\d\))/);
    if (m) {
      if (!gram) gram = m[1].trim().replace(/[,;\s]+$/, "");
      uz = uz.slice(m[0].length);
      movedGram++;
    }
  }

  // 2) Boshidagi so'z turkumi belgisi
  {
    const m = uz.match(/^(vt|vi|adj|adv|v\/|num|pron|konj|int)\b\.?\s*/);
    if (m) {
      if (!pos) pos = POS[m[1]];
      uz = uz.slice(m[0].length);
      movedPos++;
    }
  }
  uz = uz.replace(/^v\/(?=[a-zäöü])/, "");

  // 3) Nuqta-vergul va OCR belgilari
  for (const [re, to] of TYPOS) {
    if (re.test(uz)) typos++;
    uz = uz.replace(re, to);
  }
  uz = uz
    .replace(/[\\»«¿¡]/g, " ")
    .replace(/\s+([),.;:])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^A-Za-zÄÖÜäöüß0-9(~-]+/, "")
    .replace(/[\s.,;:-]+$/, "");

  if (uz.length < 3 || !/[a-z]{3}/.test(uz)) {
    dropped++;
    continue;
  }
  if (gram) {
    // Shakl bo'lagida "c" bo'lishi mumkin emas — bu OCR o'qigan "e"
    gram = gram.replace(/c/g, "e").replace(/\s+/g, " ").replace(/^[-,\s]+|[-,\s]+$/g, "");
    if (gram && /^[(a-zäöüA-ZÄÖÜ]/.test(gram)) gram = "-" + gram;
    if (!gram || gram.length > 16 || /\d/.test(gram)) gram = null;
  }
  out.push({ de: e.de, g: e.g, p: pos ?? null, f: gram ?? null, s: e.s, uz, l: e.l });
}

console.log(`yozuvlar: ${data.length} -> ${out.length} (A-L dan tashqari/nemischa emas: ${offRange}, bo'sh: ${dropped})`);
console.log(`grammatik qoldiq ko'chirildi: ${movedGram}, turkum: ${movedPos}, imlo: ${typos}`);
console.log("\nnamunalar:");
for (const de of ["Abbild", "Arbeit", "Buchausstellung", "anstellen", "Haus", "Kind"]) {
  const x = out.find((e) => e.de === de);
  if (x) console.log(`  ${(x.g ?? x.p ?? "-").padEnd(4)} ${x.de.padEnd(18)} ${(x.f ?? "").padEnd(11)} ${x.uz.slice(0, 60)}`);
}

if (apply) {
  fs.writeFileSync(FILE, JSON.stringify(out));
  console.log("\n" + FILE + " yangilandi");
} else {
  console.log("\n(--apply berilmadi — fayl o'zgarmadi)");
}
