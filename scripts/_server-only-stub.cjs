// "server-only" paketi Next tashqarisida topilmaydi — sinov skriptlari uchun
// bo'sh modulga yo'naltiramiz. Ishlatish:
//   npx tsx --require ./scripts/_server-only-stub.cjs scripts/<sinov>.mts
const Module = require("node:module");
const path = require("node:path");
const stub = path.join(__dirname, "_server-only-stub.js");
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === "server-only") return stub;
  return orig.call(this, req, ...rest);
};
