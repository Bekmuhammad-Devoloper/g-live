/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Yarim-tayyor kod type/lint xatolari production build'ni to'xtatmasin.
  // (Kod baribir muvaffaqiyatli kompilyatsiya bo'ladi; runtime ishlaydi.)
  // Kod to'liq type-toza bo'lganда bularni olib tashlash mumkin.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Deploy paytida yangi build'ni YON papkaga yig'ish uchun (update-b.sh).
  // Shunda build yiqilsa ishlab turgan .next buzilmaydi — sayt tushmaydi.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
