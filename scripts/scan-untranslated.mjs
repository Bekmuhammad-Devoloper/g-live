// Tarjimasiz qolgan matnlarni topadi — til almashganda hamma so'z o'tishi kerak.
//
//   node scripts/scan-untranslated.mjs "src/app/(app)" src/app/student
//
// TS AST bilan JSX matnlari va foydalanuvchiga ko'rinadigan joylardagi satr
// literallarini (placeholder, title, label, error, body...) yig'adi;
// t()/tr()/T()/L()/S()/LT() orqali kelganlarini o'tkazib yuboradi.
// Topilmalar qo'lda ko'rib chiqiladi: brend nomi, API kalit maydonlari, til
// endonimlari, CSS va misol e-pochtalar ataylab tarjima qilinmaydi.
// Loyiha ildizidan yuritiladi (typescript node_modules dan olinadi).
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const roots = process.argv.slice(2);
const HAS_WORD = /[A-Za-zÀ-ÿА-яЁё]{2,}/;
const TEXT_ATTR = /^(placeholder|aria-label|title|label|alt)$/;
const TEXT_PROP = /^(title|body|label|error|text|sub|desc|hint|message|placeholder|emptyText)$/;
const SKIP_CALL = /^console\.|revalidatePath|\.test$|\.replace$|\.match$|\.split$|\.startsWith$|\.endsWith$|\.includes$|\.indexOf$|localStorage|sessionStorage|writeAudit|querySelector|getElementById|^fetch$|new URL$|prisma\.|^tr$|^T$|^L$|^t$|^p$|^S$|^LT$|^getT$|^fill$|\.get$|\.append$|\.set$|\.has$|\.delete$|^label$|^tt$|^tl$/;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") yield* walk(p); }
    else if (/\.(tsx?|mts)$/.test(e.name) && !/_i18n\.ts$|\.d\.ts$/.test(e.name)) yield p;
  }
}

/** Matn ko'rinadigan joydami? */
function visible(node) {
  if (ts.isJsxText(node)) return true;
  let n = node;
  let inJsxExpr = false;
  while (n) {
    if (ts.isJsxAttribute(n)) return TEXT_ATTR.test(n.name.getText());
    if (ts.isJsxExpression(n)) inJsxExpr = true;
    if (ts.isCallExpression(n) && SKIP_CALL.test(n.expression.getText())) return false;
    if (ts.isPropertyAssignment(n)) {
      const name = n.name.getText();
      if (TEXT_PROP.test(name)) return true;
      return false;
    }
    if (ts.isReturnStatement(n) && inJsxExpr) return true;
    if (ts.isImportDeclaration(n) || ts.isTypeNode(n) || ts.isVariableDeclaration(n) && !inJsxExpr) return inJsxExpr;
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) return true;
    if (ts.isFunctionLike(n)) return false;
    n = n.parent;
  }
  return false;
}

let total = 0;
const perFile = new Map();
for (const root of roots) for (const file of walk(root)) {
  const src = fs.readFileSync(file, "utf8");
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const hits = [];
  const visit = (node) => {
    let text = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text;
    if (text && HAS_WORD.test(text) && !/^\/|^https?:|^#|^[\w-]+$|^data:|^\d/.test(text.trim()) && visible(node)) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      hits.push(`${line + 1}: ${text.trim().replace(/\s+/g, " ").slice(0, 100)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (hits.length) { perFile.set(file, hits); total += hits.length; }
}
for (const [f, hits] of [...perFile].sort((a, b) => b[1].length - a[1].length)) {
  console.log("\n## " + f.split(path.sep).join("/") + "  (" + hits.length + ")");
  for (const h of hits) console.log("  " + h);
}
console.log("\nJAMI: " + total + " ta matn, " + perFile.size + " ta fayl");
