// A serverdagi audio yozuvlar mini-servisi.
//
// Nima uchun kerak: ilova B (GCP) serverga ko'chadi, yozuv fayllari esa
// A da (/var/spool/asterisk-glive/recording) qoladi. Bu servis ularni
// FAQAT 127.0.0.1:3012 da, ichki kalit bilan beradi — B unga SSH tunnel
// (-L 3012) orqali ulanadi. Internetga hech narsa ochilmaydi.
//
// O'rnatish (A da): deploy/gcp/setup-a.sh buni systemd servis qiladi.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DIR = process.env.RECORD_DIR || "/var/spool/asterisk-glive/recording";
const KEY = process.env.INTERNAL_KEY || process.env.TELEPHONY_INTERNAL_KEY || "";
// DIQQAT: PORT emas, REC_PORT — ilovaning .env fayli EnvironmentFile sifatida
// ulanganda undagi PORT=3010 bizni bosib ketmasligi uchun.
const PORT = Number(process.env.REC_PORT || 3012);

if (!KEY) { console.error("INTERNAL_KEY berilmagan"); process.exit(1); }

const server = http.createServer((req, res) => {
  if (req.headers["x-internal-key"] !== KEY) { res.writeHead(403); res.end("forbidden"); return; }

  // Ikkala yo'l ham qabul qilinadi (ilova RECORDINGS_PROXY sifatida
  // to'g'ridan-to'g'ri shu servisga ulana olishi uchun):
  //   /rec/<fayl>.wav
  //   /api/telephony/recordings/<fayl>.wav
  const m = /^(?:\/rec|\/api\/telephony\/recordings)\/([A-Za-z0-9._%-]+\.wav)$/.exec(req.url || "");
  if (!m) { res.writeHead(404); res.end("not found"); return; }
  const file = path.join(DIR, path.basename(decodeURIComponent(m[1])));

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, {
      "Content-Type": "audio/wav",
      "Content-Length": st.size,
      "Cache-Control": "private, max-age=3600",
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", () => console.log(`rec-server 127.0.0.1:${PORT} → ${DIR}`));
