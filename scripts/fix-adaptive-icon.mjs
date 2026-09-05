// Adaptiv ikonkadagi keraksiz siqishni olib tashlaydi.
//
//   node scripts/fix-adaptive-icon.mjs
//
// MUAMMO: @capacitor/assets ikkala qatlamni ham `<inset android:inset="16.7%">`
// ichiga o'raydi. Natijada:
//   · FON 16.7% ga kichrayadi va chetlarda bo'sh joy qoladi
//   · LOGO esa ikki marta kichrayadi — biz uni allaqachon xavfsiz zonaga
//     moslab (0.45) chizganmiz, ustiga yana 16.7% qo'shiladi
// Telefonda logo avvalgi ikonkadagidan sezilarli kichik ko'rinadi.
//
// TO'G'RISI: qatlamlarni to'g'ridan-to'g'ri berish. Android o'zi 108dp
// kanvasdan markazdagi ~72dp ni ko'rsatadi, ya'ni siqish allaqachon
// tizimning ichida bor — uni qo'lda takrorlash shart emas.
//
// Skript `npm run app:icons` ning oxirida avtomatik chaqiriladi, chunki
// @capacitor/assets har safar bu fayllarni qaytadan yozib yuboradi.

import { readdir, readFile, writeFile } from "node:fs/promises";

const DIR = "android/app/src/main/res/mipmap-anydpi-v26";

const XML = `<?xml version="1.0" encoding="utf-8"?>
<!--
    DIQQAT: qatlamlar ATAYLAB <inset> siz.
    Tafsilot uchun: scripts/fix-adaptive-icon.mjs
-->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;

const files = (await readdir(DIR)).filter((f) => f.endsWith(".xml"));
let fixed = 0;

for (const f of files) {
  const path = `${DIR}/${f}`;
  const before = await readFile(path, "utf8");
  if (!before.includes("<inset")) {
    console.log(`${f} — allaqachon to'g'ri`);
    continue;
  }
  await writeFile(path, XML);
  console.log(`${f} — siqish olib tashlandi`);
  fixed++;
}

console.log(fixed > 0 ? `\nTayyor: ${fixed} ta fayl` : "\nO'zgarish kerak emas");
