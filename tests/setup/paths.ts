import path from "node:path";

/** Test bazalari faqat shu papkada yashaydi (.gitignore'da) */
export const TMP_DIR = path.resolve(__dirname, "../.tmp");

/** globalSetup yaratadigan shablon baza — har test fayli undan nusxa oladi */
export const TEMPLATE_DB = path.join(TMP_DIR, "template.db");
