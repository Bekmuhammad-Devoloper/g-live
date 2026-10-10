import { getBrand } from "@/lib/brand";

// O'quvchi portalining PWA manifesti — markaz nomi har bir nusxada o'zining brendidan olinadi
// (avval public/student.webmanifest statik fayl edi).
export const dynamic = "force-dynamic";

export async function GET() {
  const brand = await getBrand();
  const manifest = {
    id: "/student",
    name: `${brand.name} — O'quvchi`,
    short_name: brand.name,
    description: "Nemis tili darslari, uy vazifalari va natijalaringiz — bitta ilovada.",
    start_url: "/student",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e4edf3",
    theme_color: "#0e7490",
    lang: "uz",
    dir: "ltr",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Kurslar", url: "/student/kurse" },
      { name: "Mashq", url: "/student/uben" },
      { name: "Profil", url: "/student/profil" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
