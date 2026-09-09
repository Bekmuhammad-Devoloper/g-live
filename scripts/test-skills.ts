// Ko'nikma ballari — pasayish va qo'shish qoidalarini sinaydi.
//
//   npx tsx scripts/test-skills.ts
//
// Bazasiz: faqat lib/skillMath.ts (sof hisob). Muhim savollar:
//   · bugun kirilgan bo'lsa pasaymaydimi
//   · 1 kun kirilmasa bir marta, 2 kun — ikki marta pasayadimi
//   · sahifa bir kunda ko'p ochilsa o'sha kun uchun QAYTA ayirilmaydimi
//   · 0 dan pastga, 100 dan yuqoriga chiqmaydimi

import { addPoints, applyDecay, DAY_MS, pendingDecayDays, type SkillScores } from "../src/lib/skillMath";

const RATE = 5;
const base: SkillScores = { words: 40, reading: 3, listening: 100, speaking: 0 };
const t0 = new Date("2026-09-01T10:00:00Z");
const at = (h: number) => new Date(t0.getTime() + h * 60 * 60 * 1000);

let bad = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) bad++;
  console.log(`${cond ? "ok  " : "XATO"} ${name}${detail ? "  " + detail : ""}`);
}

// 1. Bugun kirgan — 10 soat o'tgan — pasaymaydi
{
  const { days } = pendingDecayDays(t0, t0, at(10));
  check("10 soat: pasayish yo'q", days === 0, `days=${days}`);
}

// 2. 1 to'liq kun (26 soat) — bir marta
{
  const { days, decayedThrough } = pendingDecayDays(t0, t0, at(26));
  const s = applyDecay(base, days, RATE);
  check("26 soat: 1 kun", days === 1 && s.words === 35 && s.listening === 95, `days=${days} words=${s.words}`);
  // decayedThrough — aynan 1 kun oldinga, 26 soat emas (qoldiq keyingi kunga o'tadi)
  check("decayedThrough = start + 1 kun", decayedThrough.getTime() === t0.getTime() + DAY_MS);
}

// 3. 2 to'liq kun (50 soat) — ikki marta
{
  const { days } = pendingDecayDays(t0, t0, at(50));
  const s = applyDecay(base, days, RATE);
  check("50 soat: 2 kun", days === 2 && s.words === 30, `days=${days} words=${s.words}`);
}

// 4. Bir kunda ko'p ochilsa qayta ayirilmaydi: 26 soatda ayirilgan (decayedAt = t0+1d),
//    30 soatda yana ochildi — hali ikkinchi to'liq kun o'tmagan
{
  const first = pendingDecayDays(t0, t0, at(26));
  const again = pendingDecayDays(t0, first.decayedThrough, at(30));
  check("30 soatda qayta ochilsa: qo'shimcha pasayish yo'q", again.days === 0, `days=${again.days}`);
  // 49 soatda — ikkinchi kun to'ldi: yana 1
  const later = pendingDecayDays(t0, first.decayedThrough, at(49));
  check("49 soatda: yana 1 kun", later.days === 1, `days=${later.days}`);
}

// 5. Qaytgach faollik yangilanadi — pasayish to'xtaydi, ball qaytmaydi
{
  const gone = applyDecay(base, 3, RATE); // 3 kun yo'q edi: words 25
  const back = pendingDecayDays(at(80), at(72), at(90)); // qaytdi (lastActive=80h), 10 soat o'tdi
  check("qaytgach: pasayish yo'q, ball 25 da qoladi", back.days === 0 && gone.words === 25, `days=${back.days} words=${gone.words}`);
}

// 6. Chegaralar
{
  const low = applyDecay({ ...base, reading: 3 }, 1, RATE);
  check("0 dan pastga tushmaydi", low.reading === 0, `reading=${low.reading}`);
  const high = addPoints({ ...base, listening: 97 }, "listening", 10);
  check("100 dan oshmaydi", high.listening === 100, `listening=${high.listening}`);
  const zeroRate = applyDecay(base, 5, 0);
  check("rate=0: pasaymaydi", zeroRate.words === base.words);
}

// 7. Qo'shish faqat o'z ko'nikmasiga
{
  const s = addPoints(base, "speaking", 8);
  check("speaking +8, boshqalar o'zgarmaydi", s.speaking === 8 && s.words === base.words && s.reading === base.reading);
}

console.log(bad === 0 ? "\nOK — hammasi kutilganidek" : `\n${bad} ta holat mos kelmadi`);
process.exit(bad === 0 ? 0 : 1);
