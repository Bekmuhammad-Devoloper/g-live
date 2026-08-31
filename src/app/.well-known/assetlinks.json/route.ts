import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Digital Asset Links — Android ilovasi (TWA) shu sayt bilan bog'langanini
// tasdiqlaydi. Bu fayl to'g'ri bo'lsa ilovada brauzer manzil qatori
// ko'rinmaydi, ya'ni haqiqiy ilovaga o'xshaydi.
//
// SHA-256 barmoq izi APK ni imzolagan kalitdan olinadi va serverdagi
// .env faylida ANDROID_CERT_SHA256 nomi bilan saqlanadi (bir nechta
// bo'lsa vergul bilan ajratiladi). Kalit o'zgarmaguncha o'zgarmaydi.

const PACKAGE = process.env.ANDROID_PACKAGE || "live.germaniya.app";

export async function GET() {
  const prints = (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);

  const body = prints.length
    ? [{
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PACKAGE,
          sha256_cert_fingerprints: prints,
        },
      }]
    : [];

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=600" },
  });
}
