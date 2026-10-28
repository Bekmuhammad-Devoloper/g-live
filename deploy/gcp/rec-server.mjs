import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DIR = process.env.RECORD_DIR || "/var/spool/asterisk-glive/recording";
const KEY = process.env.INTERNAL_KEY || process.env.TELEPHONY_INTERNAL_KEY || "";
const PORT = Number(process.env.REC_PORT || 3012);

if (!KEY) { console.error("INTERNAL_KEY berilmagan"); process.exit(1); }

const server = http.createServer((req, res) => {
  if (req.headers["x-internal-key"] !== KEY) { res.writeHead(403); res.end("forbidden"); return; }

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
