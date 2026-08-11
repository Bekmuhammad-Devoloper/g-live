// Telefoniya AMI worker — Asterisk Manager Interface hodisalarini tinglaydi
// va qo'ng'iroqlarni Call jadvaliga yozadi. Next.js doimiy TCP soketni
// ushlab turolmaydi, shuning uchun bu ALOHIDA jarayon sifatida ishlaydi:
//
//   node --env-file=.env scripts/ami-worker.mjs
//
// Kerakli .env: ASTERISK_HOST, ASTERISK_AMI_PORT, ASTERISK_AMI_USER,
// ASTERISK_AMI_PASS, DATABASE_URL.

import net from "node:net";
import path from "node:path";
import fsSync from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HOST = process.env.ASTERISK_HOST || "127.0.0.1";
const PORT = Number(process.env.ASTERISK_AMI_PORT || 5038);
const USER = process.env.ASTERISK_AMI_USER || "";
const PASS = process.env.ASTERISK_AMI_PASS || "";

if (!USER || !PASS) { console.error("AMI creds yo'q (.env)"); process.exit(1); }

// ── BITTA NUSXA KAFOLATI ──────────────────────────────────────────────
// Ilgari .pid faylli qulf ishlatilgan edi, lekin worker qo'lda ishga
// tushirilganda fayl yozilmasdi — natijada 6 ta worker parallel ishlab,
// HAR BIR qo'ng'iroqni bir necha marta bazaga yozgan.
// Lokal portni band qilish — OS darajasidagi atomar qulf: jarayon o'lsa
// port avtomatik bo'shaydi, qanday ishga tushirilishidan qat'i nazar ishlaydi.
const LOCK_PORT = Number(process.env.AMI_WORKER_LOCK_PORT || 45391);
await new Promise((resolve) => {
  const guard = net.createServer();
  guard.once("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.error("AMI worker allaqachon ishlayapti — bu nusxa to'xtatildi");
      process.exit(0);
    }
    resolve();
  });
  guard.listen(LOCK_PORT, "127.0.0.1", () => { guard.unref(); resolve(); });
});

const CAUSE_STATUS = { "16": "ANSWERED", "17": "BUSY", "19": "NO_ANSWER", "21": "FAILED", "0": "NO_ANSWER" };
// Bizning raqamimiz — kiruvchi/chiquvchi farqini aniq ajratish uchun
const DID = String(process.env.TELEPHONY_DID || "550552022").replace(/\D/g, "");
// "<unknown>", "anonymous", bo'sh — bular haqiqiy raqam emas
const isRealNumber = (v) => {
  const s = String(v ?? "").trim();
  return Boolean(s) && !/^<?unknown>?$/i.test(s) && !/^anonymous$/i.test(s) && /\d{5,}/.test(s);
};

// channel(uniqueid) -> { callId, phone, operator, recordFile, answeredAt, inbound }
const chans = new Map();

function encode(pairs) { return pairs.map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n"; }
function parseBlock(blk) {
  const o = {};
  for (const line of blk.split("\r\n")) { const i = line.indexOf(":"); if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return o;
}

// Diagnostika: hodisalarni faylga yozamiz (nosozlikni topish uchun)
const LOG = path.join(process.cwd(), "ami-worker.log");
const log = (m) => { try { fsSync.appendFileSync(LOG, `[${new Date().toISOString().slice(11, 19)}] ${m}\n`); } catch {} };

async function onEvent(ev) {
  // MUHIM: bitta qo'ng'iroqning operator va mijoz kanallari HAR XIL Uniqueid'ga ega,
  // lekin Linkedid ular uchun BIR XIL. Shuning uchun guruhlash kaliti — Linkedid.
  const id = ev.Linkedid || ev.Uniqueid;
  try {
    switch (ev.Event) {
      case "Newchannel": {
        if (!id) break;
        const c = chans.get(id) || {};
        // Bitta qo'ng'iroqda bir nechta kanal (trunk + operator) bo'ladi va ular
        // bir xil Linkedid'ga ega. Operator kanalining CallerIDNum'i "<unknown>"
        // bo'lishi mumkin — u haqiqiy raqamni O'CHIRIB YUBORMASLIGI kerak.
        const num = String(ev.CallerIDNum ?? "").trim();
        const real = num && !/^<?unknown>?$/i.test(num) && !/^anonymous$/i.test(num);
        if (real) c.phone = num;              // haqiqiy raqam — doim ustun
        else if (!c.phone) c.phone = num;     // hech narsa yo'q bo'lsa — shu qoladi
        // Yo'nalishni aniqlash — faqat kontekstga qarash YETARLI EMAS:
        // chiquvchi qo'ng'iroqning trunk oyog'i ham "gl-from-trunk" kontekstida
        // ko'rinadi va soxta "kiruvchi" yozuv yaratardi. Haqiqiy kiruvchi
        // qo'ng'iroqda terilgan raqam — BIZNING raqamimiz (DID).
        if (c.inbound === undefined) {
          const fromTrunk = String(ev.Context || "").includes("from-trunk");
          const toOurDid = String(ev.Exten || "").replace(/\D/g, "").endsWith(DID);
          c.inbound = fromTrunk && toOurDid;
        }
        chans.set(id, c);
        break;
      }
      case "VarSet": {
        if (!id) break;
        const c = chans.get(id) || {};
        if (ev.Variable === "CALLRECORD_ID") { c.callId = ev.Value; log(`CALLRECORD_ID=${ev.Value} id=${id}`); }
        if (ev.Variable === "RECORD_FILE") c.recordFile = path.basename(ev.Value) + ".wav";
        chans.set(id, c);
        break;
      }
      // DIQQAT: DialBegin — "terila boshladi", javob EMAS. Javob = bridge/AgentConnect
      // yoki DialEnd(ANSWER). answeredAt darhol bazaga yoziladi — softphone shu orqali
      // taymerni faqat mijoz ko'targanda boshlaydi.
      case "DialEnd":
        if (ev.DialStatus && ev.DialStatus !== "ANSWER") break;
      // fallthrough
      case "AgentConnect": case "BridgeEnter": {
        if (!id) break;
        const c = chans.get(id) || {};
        if (!c.answeredAt) {
          c.answeredAt = new Date();
          log(`JAVOB: ${ev.Event} id=${id} callId=${c.callId || "YO'Q"} ch=${ev.Channel || ""}`);
          if (c.callId) {
            prisma.call.update({
              where: { id: c.callId },
              data: { status: "ANSWERED", answeredAt: c.answeredAt },
            }).then(() => log(`  → bazaga yozildi (${c.callId})`))
              .catch((e) => log(`  → XATO: ${e.message}`));
          }
        }
        chans.set(id, c);
        break;
      }
      case "Hangup": {
        if (!id) break;
        const c = chans.get(id);
        chans.delete(id);
        if (!c) break;
        // Javob berilgan bo'lsa — ANSWERED. Aks holda:
        //   kiruvchi  → MISSED  (operator ko'tarmadi — "Qabul qilinmagan" ro'yxatiga tushadi)
        //   chiquvchi → sabab bo'yicha (band / javobsiz / xato)
        const status = c.answeredAt
          ? "ANSWERED"
          : c.inbound
            ? (ev.Cause === "17" ? "BUSY" : "MISSED")
            : (CAUSE_STATUS[ev.Cause] || "NO_ANSWER");
        const duration = c.answeredAt ? Math.max(0, Math.round((Date.now() - new Date(c.answeredAt).getTime()) / 1000)) : 0;
        const recordingUrl = c.recordFile ? `/api/telephony/recordings/${c.recordFile}` : null;
        if (c.callId) {
          // externalId ham yoziladi — CDR sinxronizatsiyasi shu qo'ng'iroqni
          // "yangi" deb qayta yozib qo'ymasligi uchun
          await prisma.call.update({
            where: { id: c.callId },
            data: { externalId: id, status, duration, recordingUrl, answeredAt: c.answeredAt || null, endedAt: new Date() },
          }).catch(() => {});
        } else if (c.inbound && isRealNumber(c.phone)) {
          // Kiruvchi — lidni raqam bo'yicha topib bog'laymiz.
          // externalId (Linkedid) UNIQUE: worker qayta ulansa yoki CDR
          // sinxronizatsiyasi ishlasa ham bir qo'ng'iroq IKKI MARTA yozilmaydi.
          const digits = String(c.phone).replace(/\D/g, "").slice(-9);
          const lead = digits ? await prisma.lead.findFirst({ where: { phone: { contains: digits } }, orderBy: { updatedAt: "desc" }, select: { id: true, fullName: true, managerId: true, manager: { select: { fullName: true } } } }) : null;
          await prisma.call.upsert({
            where: { externalId: id },
            update: { status, duration, recordingUrl, answeredAt: c.answeredAt || null, endedAt: new Date() },
            create: {
              externalId: id,
              direction: "INCOMING", status, phone: String(c.phone), duration, recordingUrl,
              leadId: lead?.id || null, contactName: lead?.fullName || null,
              operatorId: lead?.managerId || null, operatorName: lead?.manager?.fullName || null,
              answeredAt: c.answeredAt || null, endedAt: new Date(),
              callbackStatus: status === "MISSED" || status === "NO_ANSWER" ? "PENDING" : "NONE",
            },
          }).catch((e) => log(`create XATO: ${e.message}`));
        } else if (c.inbound) {
          log(`o'tkazib yuborildi (raqam yo'q): id=${id} phone=${c.phone ?? "-"}`);
        }
        break;
      }
    }
  } catch (e) { console.error("event err", e?.message); }
}

let backoff = 2000;
function connect() {
  const sock = net.createConnection({ host: HOST, port: PORT });
  let buf = "";
  let ka;
  sock.on("connect", () => { console.log("AMI ulandi"); backoff = 2000; });
  sock.on("data", (d) => {
    buf += d.toString();
    if (buf.includes("Asterisk Call Manager") && !sock._loggedIn) {
      sock._loggedIn = true;
      sock.write(encode([["Action", "Login"], ["Username", USER], ["Secret", PASS], ["Events", "on"]]));
      ka = setInterval(() => { try { sock.write(encode([["Action", "Ping"]])); } catch {} }, 30000);
    }
    let idx;
    while ((idx = buf.indexOf("\r\n\r\n")) !== -1) {
      const blk = buf.slice(0, idx); buf = buf.slice(idx + 4);
      const ev = parseBlock(blk);
      if (ev.Event) onEvent(ev);
    }
  });
  const retry = () => { clearInterval(ka); sock._loggedIn = false; const w = Math.min(backoff, 60000); console.log(`AMI qayta ulanish ${w}ms`); setTimeout(connect, w); backoff = Math.min(backoff * 2, 60000); };
  sock.on("error", (e) => console.error("AMI xato:", e.message));
  sock.on("close", retry);
}

console.log(`AMI worker → ${HOST}:${PORT}`);
connect();
