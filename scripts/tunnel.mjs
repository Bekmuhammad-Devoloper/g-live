// Telefoniya AMI tunneli — localhost:5039 → 89.126.208.123 (asterisk-glive)
// `npm run dev` bilan avtomatik ishga tushadi. Agar allaqachon ochiq bo'lsa — tegmaydi.
// Eski loyihaning AMI'siga (5038) UMUMAN tegmaydi.

import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const PORT = 5039;
const HOST = "ubuntu@89.126.208.123";
const KEY = path.join(os.homedir(), ".ssh", "gl-tunnel");

const isOpen = () =>
  new Promise((res) => {
    const s = net.createConnection({ host: "127.0.0.1", port: PORT });
    const done = (v) => { try { s.destroy(); } catch {} res(v); };
    s.setTimeout(1500);
    s.on("connect", () => done(true));
    s.on("error", () => done(false));
    s.on("timeout", () => done(false));
  });

// Tunnelni to'g'ridan-to'g'ri ochish o'rniga NAZORATCHI ishga tushiriladi:
// u tunnel uzilsa avtomatik qayta tiklaydi (tarmoq uzilishi, noutbuk uxlashi,
// server qayta yuklanishi). Nazoratchining o'zi bitta nusxada ishlaydi.
if (!fs.existsSync(KEY)) {
  console.log("⚠️  SSH kalit topilmadi: " + KEY + " — telefoniya ishlamaydi");
} else {
  const keeper = path.join(process.cwd(), "scripts", "tunnel-keeper.mjs");
  spawn(process.execPath, [keeper], {
    detached: true, stdio: "ignore", windowsHide: true, cwd: process.cwd(),
  }).unref();

  // Ochilishini kutamiz (maks 12s) — faqat xabar berish uchun
  let ok = await isOpen();
  for (let i = 0; !ok && i < 12; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ok = await isOpen();
  }
  console.log(ok ? "📞 Telefoniya tunneli ochiq (5039) — nazoratchi kuzatmoqda" : "⚠️  Tunnel hali ochilmadi — nazoratchi urinishda davom etadi");
}

// ── AMI worker (qo'ng'iroq tarixini LOKAL bazaga yozadi) ──
// Serverdagi worker server bazasiga yozadi; lokalda ishlash uchun shu yerda ham kerak.
const workerPath = path.join(process.cwd(), "scripts", "ami-worker.mjs");
if (fs.existsSync(workerPath)) {
  // Ilgari bu yerda .pid faylli qulf bor edi, lekin worker qo'lda ishga
  // tushirilganda fayl yozilmasdi va 6 tagacha nusxa parallel ishlab ketgan
  // (har bir qo'ng'iroq bazaga bir necha marta yozilgan). Endi qulf
  // worker'ning O'ZIDA — u lokal portni band qiladi va ortiqcha nusxa
  // darhol o'zini to'xtatadi. Shuning uchun bu yerda shunchaki chaqiramiz.
  const w = spawn(process.execPath, ["--env-file=.env", workerPath], {
    detached: true, stdio: "ignore", windowsHide: true, cwd: process.cwd(),
  });
  w.unref();
  console.log("📋 AMI worker tekshirildi (qo'ng'iroq tarixi yoziladi)");
}
