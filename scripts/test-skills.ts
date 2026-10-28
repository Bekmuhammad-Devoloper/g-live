import { addPoints, applyDecay, DAY_MS, dayKey, GAME_MIN_ACCURACY, pendingDecayDays, type SkillScores } from "../src/lib/skillMath";

const RATE = 5;
const base: SkillScores = { words: 40, reading: 3, listening: 100, speaking: 0 };
const t0 = new Date("2026-09-01T10:00:00Z");
const at = (h: number) => new Date(t0.getTime() + h * 60 * 60 * 1000);

let bad = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) bad++;
  console.log(`${cond ? "ok  " : "XATO"} ${name}${detail ? "  " + detail : ""}`);
}

{
  const { days } = pendingDecayDays(t0, t0, at(10));
  check("10 soat: pasayish yo'q", days === 0, `days=${days}`);
}

{
  const { days, decayedThrough } = pendingDecayDays(t0, t0, at(26));
  const s = applyDecay(base, days, RATE);
  check("26 soat: 1 kun", days === 1 && s.words === 35 && s.listening === 95, `days=${days} words=${s.words}`);
  check("decayedThrough = start + 1 kun", decayedThrough.getTime() === t0.getTime() + DAY_MS);
}

{
  const { days } = pendingDecayDays(t0, t0, at(50));
  const s = applyDecay(base, days, RATE);
  check("50 soat: 2 kun", days === 2 && s.words === 30, `days=${days} words=${s.words}`);
}

{
  const first = pendingDecayDays(t0, t0, at(26));
  const again = pendingDecayDays(t0, first.decayedThrough, at(30));
  check("30 soatda qayta ochilsa: qo'shimcha pasayish yo'q", again.days === 0, `days=${again.days}`);
  const later = pendingDecayDays(t0, first.decayedThrough, at(49));
  check("49 soatda: yana 1 kun", later.days === 1, `days=${later.days}`);
}

{
  const gone = applyDecay(base, 3, RATE);
  const back = pendingDecayDays(at(80), at(72), at(90));
  check("qaytgach: pasayish yo'q, ball 25 da qoladi", back.days === 0 && gone.words === 25, `days=${back.days} words=${gone.words}`);
}

{
  const low = applyDecay({ ...base, reading: 3 }, 1, RATE);
  check("0 dan pastga tushmaydi", low.reading === 0, `reading=${low.reading}`);
  const high = addPoints({ ...base, listening: 97 }, "listening", 10);
  check("100 dan oshmaydi", high.listening === 100, `listening=${high.listening}`);
  const zeroRate = applyDecay(base, 5, 0);
  check("rate=0: pasaymaydi", zeroRate.words === base.words);
}

{
  const s = addPoints(base, "speaking", 8);
  check("speaking +8, boshqalar o'zgarmaydi", s.speaking === 8 && s.words === base.words && s.reading === base.reading);
}

{
  const k = dayKey(new Date(2026, 8, 9, 23, 59));
  check("dayKey mahalliy sana", k === "2026-09-09", k);
  check("7/10 ball beradi, 6/10 bermaydi", 7 / 10 >= GAME_MIN_ACCURACY && !(6 / 10 >= GAME_MIN_ACCURACY));
}

console.log(bad === 0 ? "\nOK — hammasi kutilganidek" : `\n${bad} ta holat mos kelmadi`);
process.exit(bad === 0 ? 0 : 1);
