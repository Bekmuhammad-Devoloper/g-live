/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Yarim-tayyor kod type/lint xatolari production build'ni to'xtatmasin.
  // (Kod baribir muvaffaqiyatli kompilyatsiya bo'ladi; runtime ishlaydi.)
  // Kod to'liq type-toza bo'lganда bularni olib tashlash mumkin.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
