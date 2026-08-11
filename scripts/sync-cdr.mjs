// CDR sinxronizatsiyasi — Asterisk'ning Master.csv faylidan BARCHA haqiqiy
// qo'ng'iroqlarni bazaga import qiladi.
//
// NEGA KERAK: ami-worker faqat u ishlab turganda hodisalarni eshitadi.
// Noutbuk o'chiq bo'lsa yoki tunnel uzilsa — o'sha paytdagi qo'ng'iroqlar
// yo'qoladi. CDR esa Asterisk tomonidan DOIM yoziladi va to'liq manba
// hisoblanadi. Bu skript ikkalasini birlashtiradi (externalId orqali
// takrorlanishning oldi olinadi).
//
//   node --env-file=.env scripts/sync-cdr.mjs
//
// Server ustida ishlaganda CDR fayli lokal bo'ladi (CDR_FILE), aks holda
// SSH orqali o'qiladi.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const execFileP = promisify(execFile);
const prisma = new PrismaClient();

const DID = String(process.env.TELEPHONY_DID || "550552022").replace(/\D/g, "");
const CDR_FILE = process.env.CDR_FILE || "/var/log/asterisk-glive/cdr-csv/Master.csv";
const REC_DIR = process.env.ASTERISK_RECORD_DIR || "/var/spool/asterisk-glive/recording";
const SSH_HOST = process.env.TELEPHONY_SSH_HOST || "ubuntu@89.126.208.123";
const SSH_KEY = process.env.TELEPHONY_SSH_KEY || path.join(os.homedir(), ".ssh", "gl-tunnel");

// ── Manba: lokal fayl yoki SSH ────────────────────────────────────────
async function readRemote() {
  const cmd = `sudo cat ${CDR_FILE}; echo "===RECORDINGS==="; sudo find ${REC_DIR} -name '*.wav' -size +1000c -printf '%f\\n' 2>/dev/null`;
  const { stdout } = await execFileP(
    "ssh",
    ["-i", SSH_KEY, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15", SSH_HOST, cmd],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout;
}

async function readSource() {
  // Serverning o'zida ishlayotgan bo'lsak — to'g'ridan-to'g'ri o'qiymiz
  if (fs.existsSync(CDR_FILE)) {
    const csv = fs.readFileSync(CDR_FILE, "utf8");
    let recs = [];
    try {
      recs = fs.readdirSync(REC_DIR).filter((f) => {
        if (!f.endsWith(".wav")) return false;
        try { return fs.statSync(path.join(REC_DIR, f)).size > 1000; } catch { return false; }
      });
    } catch {}
    return { csv, recs };
  }
  const out = await readRemote();
  const [csv, rec = ""] = out.split("===RECORDINGS===");
  return { csv, recs: rec.split("\n").map((s) => s.trim()).filter(Boolean) };
}

// ── CSV qatorini ajratish (qo'shtirnoq ichida vergul bo'lishi mumkin) ──
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }  // "" → literal qo'shtirnoq
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// Asterisk master.csv ustunlari
const C = { SRC: 1, DST: 2, DCONTEXT: 3, CHANNEL: 5, DSTCHANNEL: 6, START: 9, ANSWER: 10, END: 11, DURATION: 12, BILLSEC: 13, DISPOSITION: 14, UNIQUEID: 16 };

// CDR vaqtlari server mintaqasida (UTC) yoziladi
const toDate = (s) => {
  if (!s || !/\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : d;
};

const isRealNumber = (v) => {
  const s = String(v ?? "").trim();
  return Boolean(s) && !/^<?unknown>?$/i.test(s) && !/^anonymous$/i.test(s) && /\d{5,}/.test(s);
};

async function main() {
  const { csv, recs } = await readSource();
  const rows = csv.split("\n").map((l) => l.trim()).filter(Boolean).map(parseCsvLine).filter((r) => r.length > C.UNIQUEID);

  // Bitta qo'ng'iroq CDR'da bir NECHTA qator bo'lishi mumkin (navbatdagi har
  // bir operatorga urinish alohida qator). Ularni uniqueid bo'yicha birlashtiramiz.
  const calls = new Map();
  for (const r of rows) {
    const uid = r[C.UNIQUEID];
    if (!uid) continue;
    const g = calls.get(uid) || { rows: [] };
    g.rows.push(r);
    calls.set(uid, g);
  }

  // Operator kanalini (PJSIP/glive8-xxxx) foydalanuvchiga bog'lash uchun
  const users = await prisma.user.findMany({
    where: { sipExtension: { not: null } },
    select: { id: true, fullName: true, sipExtension: true },
  });
  const byExt = new Map(users.map((u) => [String(u.sipExtension), u]));
  const extOf = (chan) => {
    const m = /^PJSIP\/([A-Za-z0-9_-]+?)-[0-9a-f]+$/.exec(String(chan || ""));
    return m ? m[1] : null;
  };

  let created = 0, updated = 0, skipped = 0;

  for (const [uid, g] of calls) {
    const first = g.rows[0];
    const src = first[C.SRC];
    const dst = first[C.DST];
    const inbound = String(first[C.DCONTEXT] || "").includes("from-trunk") && String(dst).replace(/\D/g, "").endsWith(DID);

    // Abonent raqami: kiruvchida — qo'ng'iroq qiluvchi, chiquvchida — terilgan
    const phone = inbound ? src : dst;
    if (!isRealNumber(phone)) { skipped++; continue; }

    // MUHIM: dialplan Queue'dan oldin Answer() chaqiradi, shuning uchun CDR'dagi
    // "ANSWERED" mijoz OPERATOR bilan gaplashdi degani EMAS — u shunchaki
    // navbatda kutgan bo'lishi mumkin. Haqiqiy javob = operator oyog'i
    // (dstchannel) javob bergan qator.
    const agentRow = g.rows.find((r) => r[C.DSTCHANNEL] && String(r[C.DISPOSITION]).toUpperCase() === "ANSWERED");
    const answered = Boolean(agentRow) || (!inbound && g.rows.some((r) => String(r[C.DISPOSITION]).toUpperCase() === "ANSWERED" && Number(r[C.BILLSEC]) > 0));

    let status;
    if (answered) status = "ANSWERED";
    else if (inbound) status = g.rows.some((r) => String(r[C.DISPOSITION]).toUpperCase() === "BUSY") ? "BUSY" : "MISSED";
    else {
      const d = g.rows.map((r) => String(r[C.DISPOSITION]).toUpperCase());
      status = d.includes("BUSY") ? "BUSY" : d.includes("FAILED") ? "FAILED" : "NO_ANSWER";
    }

    // Suhbat davomiyligi — faqat javob berilgan oyoqniki
    const talkRow = agentRow || (answered ? g.rows.find((r) => Number(r[C.BILLSEC]) > 0) : null);
    const duration = talkRow ? Math.max(0, Number(talkRow[C.BILLSEC]) || 0) : 0;

    const startedAt = toDate(first[C.START]) || new Date();
    const endedAt = g.rows.map((r) => toDate(r[C.END])).filter(Boolean).sort((a, b) => b - a)[0] || null;
    const answeredAt = answered ? (toDate((talkRow || first)[C.ANSWER]) || startedAt) : null;

    // Operator
    const opChan = agentRow?.[C.DSTCHANNEL] || (inbound ? null : first[C.CHANNEL]);
    const opUser = opChan ? byExt.get(extOf(opChan) || "") : null;

    // Yozuv fayli: 20260811-092031-incoming-958262668-queue.wav
    // Faqat bo'sh bo'lmagan (>1000 bayt) fayllar ro'yxatga kirgan.
    const digits = String(phone).replace(/\D/g, "");
    const stamp = first[C.START]?.replace(/[-: ]/g, "").slice(0, 8);
    const rec = recs.find((f) => f.includes(digits) && (!stamp || f.startsWith(stamp)));
    const recordingUrl = rec ? `/api/telephony/recordings/${rec}` : null;

    // Lidni raqam bo'yicha bog'laymiz
    const tail = digits.slice(-9);
    const lead = tail
      ? await prisma.lead.findFirst({ where: { phone: { contains: tail } }, orderBy: { updatedAt: "desc" }, select: { id: true, fullName: true, managerId: true, manager: { select: { fullName: true } } } })
      : null;

    const base = {
      direction: inbound ? "INCOMING" : "OUTGOING",
      status, phone: String(phone), duration,
      startedAt, answeredAt, endedAt,
      leadId: lead?.id ?? null,
      contactName: lead?.fullName ?? null,
      operatorId: opUser?.id ?? lead?.managerId ?? null,
      operatorName: opUser?.fullName ?? lead?.manager?.fullName ?? null,
    };
    if (recordingUrl) base.recordingUrl = recordingUrl;

    const existing = await prisma.call.findUnique({ where: { externalId: uid }, select: { id: true } });
    if (existing) {
      // Mavjud yozuvni yangilaymiz, lekin operator qo'lda qo'ygan izoh va
      // qayta bog'lanish holatiga TEGMAYMIZ
      await prisma.call.update({ where: { externalId: uid }, data: base });
      updated++;
    } else {
      await prisma.call.create({
        data: {
          ...base,
          externalId: uid,
          callbackStatus: status === "MISSED" || status === "NO_ANSWER" || status === "BUSY" ? "PENDING" : "NONE",
        },
      });
      created++;
    }
  }

  return { total: calls.size, created, updated, skipped };
}

main()
  .then((r) => { console.log(`CDR sinxronizatsiyasi: jami ${r.total}, yangi ${r.created}, yangilandi ${r.updated}, o'tkazildi ${r.skipped}`); })
  .catch((e) => { console.error("CDR sinxronizatsiya xatosi:", e?.message || e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
