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

if (!fs.existsSync(KEY)) {
  console.log("⚠️  SSH kalit topilmadi: " + KEY + " — telefoniya ishlamaydi");
} else {
  const keeper = path.join(process.cwd(), "scripts", "tunnel-keeper.mjs");
  spawn(process.execPath, [keeper], {
    detached: true, stdio: "ignore", windowsHide: true, cwd: process.cwd(),
  }).unref();

  let ok = await isOpen();
  for (let i = 0; !ok && i < 12; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ok = await isOpen();
  }
  console.log(ok ? "📞 Telefoniya tunneli ochiq (5039) — nazoratchi kuzatmoqda" : "⚠️  Tunnel hali ochilmadi — nazoratchi urinishda davom etadi");
}

const workerPath = path.join(process.cwd(), "scripts", "ami-worker.mjs");
if (fs.existsSync(workerPath)) {
  const w = spawn(process.execPath, ["--env-file=.env", workerPath], {
    detached: true, stdio: "ignore", windowsHide: true, cwd: process.cwd(),
  });
  w.unref();
  console.log("📋 AMI worker tekshirildi (qo'ng'iroq tarixi yoziladi)");
}
