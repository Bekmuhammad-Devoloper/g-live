import path from "node:path";
import { defineConfig } from "vitest/config";

// Finance V2 testlari. Vitest loyihaga Phase 0 (SAFETY) da qo'shildi.
//
// Ikki timezone'da ishlatiladi (CI: TZ=UTC va TZ=Asia/Tashkent) — oy
// chegaralari server mahalliy vaqtiga tasodifan bog'lanib qolmasligi uchun.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/globalSetup.ts"],
    // Prisma sxemasi bitta shablon bazaga bir marta yoziladi (globalSetup);
    // har test fayli o'z nusxasini oladi — fayllar bir-biriga xalaqit bermaydi.
    fileParallelism: true,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
