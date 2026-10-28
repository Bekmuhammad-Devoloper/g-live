import { NextResponse } from "next/server";

export const runtime = "nodejs";

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
