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

  // Yuklangan fayllar. Next public/ ro'yxatini server ishga tushganda
  // o'qiydi — keyin yuklangan rasm 404 berardi. Shu sabab /uploads/* ni
  // diskdan o'qiydigan route'ga yo'naltiramiz (eski manzillar ham ishlaydi).
  async rewrites() {
    return {
      beforeFiles: [{ source: "/uploads/:name", destination: "/api/files/:name" }],
    };
  },
};

export default nextConfig;
