// Build oldidan tekshiruv: dev server ishlab turgan bo'lsa BUILD QILMAYMIZ.
//
// NEGA: `next build` va `next dev` bitta `.next` papkasidan foydalanadi.
// Ikkalasi baravar ishlasa kesh buziladi va dev server "Cannot find module
// '[turbopack]_runtime.js'" yoki "Internal Server Error" bera boshlaydi —
// buni topish qiyin, chunki kod aybdor emas.
//
// Majburan build qilish kerak bo'lsa: FORCE_BUILD=1 npm run build

import net from "node:net";

const PORT = Number(process.env.PORT || 3000);

const busy = await new Promise((res) => {
  const s = net.createConnection({ host: "127.0.0.1", port: PORT });
  const done = (v) => { try { s.destroy(); } catch {} res(v); };
  s.setTimeout(1500);
  s.on("connect", () => done(true));
  s.on("error", () => done(false));
  s.on("timeout", () => done(false));
});

if (busy && !process.env.FORCE_BUILD) {
  console.error(
    `\n❌ Build to'xtatildi: ${PORT}-portda dev server ishlayapti.\n\n` +
    `   next build va next dev bitta .next papkasini ishlatadi —\n` +
    `   baravar ishlasa kesh buziladi va sayt 500 xato bera boshlaydi.\n\n` +
    `   Avval dev serverni yoping (Ctrl+C), keyin qayta urinib ko'ring.\n` +
    `   Baribir davom etmoqchi bo'lsangiz: FORCE_BUILD=1 npm run build\n`
  );
  process.exit(1);
}
