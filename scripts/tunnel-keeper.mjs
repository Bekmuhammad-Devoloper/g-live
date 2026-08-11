// SSH tunnel nazoratchisi — tunnel uzilsa AVTOMATIK qayta tiklaydi.
//
// NEGA KERAK: `ssh -N` jarayoni tarmoq uzilganda, noutbuk uxlab qolganda
// yoki server qayta yuklanganda o'ladi. Ilgari uni hech kim tiklamas edi va
// foydalanuvchi faqat qo'ng'iroq qilmoqchi bo'lganda "tunnel yopiq" xatosini
// ko'rardi. Endi bu jarayon fonda turadi va tunnelni tirik saqlaydi.
//
// Bitta nusxa kafolati — lokal portni band qilish (ami-worker'dagi kabi).

import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const PORT = Number(process.env.ASTERISK_AMI_PORT || 5039);
const HOST = process.env.TELEPHONY_SSH_HOST || "ubuntu@89.126.208.123";
const KEY = process.env.TELEPHONY_SSH_KEY || path.join(os.homedir(), ".ssh", "gl-tunnel");
const LOCK_PORT = Number(process.env.TUNNEL_KEEPER_LOCK_PORT || 45392);
const LOG = path.join(process.cwd(), "tunnel.log");

const log = (m) => {
  const line = `[${new Date().toISOString().slice(0, 19).replace("T", " ")}] ${m}\n`;
  try { fs.appendFileSync(LOG, line); } catch {}
  process.stdout.write(line);
};

// ── Bitta nusxa ──
await new Promise((resolve) => {
  const guard = net.createServer();
  guard.once("error", (e) => {
    if (e.code === "EADDRINUSE") { log("nazoratchi allaqachon ishlayapti — chiqildi"); process.exit(0); }
    resolve();
  });
  guard.listen(LOCK_PORT, "127.0.0.1", () => { guard.unref(); resolve(); });
});

if (!fs.existsSync(KEY)) { log(`SSH kalit topilmadi: ${KEY}`); process.exit(1); }

const isOpen = () =>
  new Promise((res) => {
    const s = net.createConnection({ host: "127.0.0.1", port: PORT });
    const done = (v) => { try { s.destroy(); } catch {} res(v); };
    s.setTimeout(2000);
    s.on("connect", () => done(true));
    s.on("error", () => done(false));
    s.on("timeout", () => done(false));
  });

const SSH_ARGS = [
  "-N", "-i", KEY,
  "-o", "BatchMode=yes",
  "-o", "StrictHostKeyChecking=accept-new",
  "-o", "ExitOnForwardFailure=yes",
  // Uzilishni TEZ sezish uchun: 15s×3 = 45s ichida ssh o'zi chiqadi
  "-o", "ServerAliveInterval=15",
  "-o", "ServerAliveCountMax=3",
  "-o", "ConnectTimeout=15",
  "-L", `${PORT}:127.0.0.1:${PORT}`,
  // 3011 → serverdagi GL-EDU (3010): qo'ng'iroq yozuvlarini eshitish uchun
  "-L", "3011:127.0.0.1:3010",
  HOST,
];

let stopping = false;
let delay = 2000;               // qayta urinish kechikishi
const MAX_DELAY = 60_000;

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn("ssh", SSH_ARGS, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += String(d).slice(0, 500); });
    child.on("exit", (code) => resolve({ code, stderr: stderr.trim() }));
    child.on("error", (e) => resolve({ code: -1, stderr: e.message }));
  });
}

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; process.exit(0); });

log("tunnel nazoratchisi ishga tushdi");

while (!stopping) {
  const started = Date.now();

  // Fonda kutamiz: port ochilishi bilan bir marta xabar yozamiz
  void (async () => {
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (Date.now() - started > 20_000) return;   // bu urinish barbod bo'ldi
      if (await isOpen()) { log("tunnel ochiq (5039)"); return; }
    }
  })();

  const { code, stderr } = await runOnce();
  const lived = Date.now() - started;

  if (lived > 30_000) {
    // Uzoq ishlagan — bu oddiy uzilish, darhol qayta ulanamiz
    log(`tunnel uzildi (${Math.round(lived / 1000)}s ishladi) — qayta ulanmoqda`);
    delay = 2000;
  } else {
    // Tez o'ldi — muammo bor (kalit, tarmoq, port band). Kechikishni oshiramiz.
    log(`ulanib bo'lmadi (code=${code})${stderr ? ": " + stderr.split("\n")[0] : ""} — ${Math.round(delay / 1000)}s dan keyin qayta urinish`);
    delay = Math.min(delay * 2, MAX_DELAY);
  }

  await new Promise((r) => setTimeout(r, delay));

  // Boshqa birov tunnelni ochib qo'ygan bo'lsa — kutamiz, urishmaymiz
  if (await isOpen()) {
    log("tunnel boshqa jarayon tomonidan ochilgan — kuzatishda davom etamiz");
    while (!stopping && (await isOpen())) await new Promise((r) => setTimeout(r, 5000));
  }
}
