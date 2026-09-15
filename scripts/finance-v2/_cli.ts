// Finance V2 skriptlari uchun umumiy yordamchi: argumentlar, DB yo'li, chiqish.
import path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "../..");

/** `--key value` va `--flag` ko'rinishidagi argumentlar */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i++; } else out[key] = true;
  }
  return out;
}

/** DATABASE_URL (`file:./dev.db`, prisma/ ga nisbatan) yoki `--db` → absolyut yo'l */
export function resolveDbPath(args: Record<string, string | true>): string {
  if (typeof args.db === "string") return path.resolve(args.db);
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) throw new Error("DATABASE_URL `file:` bo'lishi kerak yoki --db bering");
  const raw = url.slice("file:".length);
  // Prisma nisbiy `file:` yo'lni prisma/schema.prisma papkasiga nisbatan o'qiydi
  return path.isAbsolute(raw) ? raw : path.resolve(REPO_ROOT, "prisma", raw);
}

export function fail(message: string, code = 1): never {
  console.error(`✗ ${message}`);
  process.exit(code);
}

export function printJson(label: string, value: unknown): void {
  console.log(`## ${label}`);
  console.log(JSON.stringify(value, null, 2));
}
