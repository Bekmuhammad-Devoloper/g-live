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
const DID = String(process.env.TELEPHONY_DID || "550552022").replace(/\D/g, "");
const isRealNumber = (v) => {
  const s = String(v ?? "").trim();
  return Boolean(s) && !/^<?unknown>?$/i.test(s) && !/^anonymous$/i.test(s) && /\d{5,}/.test(s);
};

const chans = new Map();

function encode(pairs) { return pairs.map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n"; }
function parseBlock(blk) {
  const o = {};
  for (const line of blk.split("\r\n")) { const i = line.indexOf(":"); if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return o;
}

const LOG = path.join(process.cwd(), "ami-worker.log");
const log = (m) => { try { fsSync.appendFileSync(LOG, `[${new Date().toISOString().slice(11, 19)}] ${m}\n`); } catch {} };

async function onEvent(ev) {
  const id = ev.Linkedid || ev.Uniqueid;
  try {
    switch (ev.Event) {
      case "Newchannel": {
        if (!id) break;
        const c = chans.get(id) || {};
        const num = String(ev.CallerIDNum ?? "").trim();
        const real = num && !/^<?unknown>?$/i.test(num) && !/^anonymous$/i.test(num);
        if (real) c.phone = num;
        else if (!c.phone) c.phone = num;
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
      case "DialEnd":
        if (ev.DialStatus && ev.DialStatus !== "ANSWER") break;
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
        const status = c.answeredAt
          ? "ANSWERED"
          : c.inbound
            ? (ev.Cause === "17" ? "BUSY" : "MISSED")
            : (CAUSE_STATUS[ev.Cause] || "NO_ANSWER");
        const duration = c.answeredAt ? Math.max(0, Math.round((Date.now() - new Date(c.answeredAt).getTime()) / 1000)) : 0;
        const recordingUrl = c.recordFile ? `/api/telephony/recordings/${c.recordFile}` : null;
        if (c.callId) {
          await prisma.call.update({
            where: { id: c.callId },
            data: { externalId: id, status, duration, recordingUrl, answeredAt: c.answeredAt || null, endedAt: new Date() },
          }).catch(() => {});
        } else if (c.inbound && isRealNumber(c.phone)) {
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
