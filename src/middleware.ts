import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-gl-path", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|api/|uploads/|favicon|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|woff2?|txt|xml|json|webmanifest|apk|mp4|mp3|wav|pdf)$).*)"],
};
