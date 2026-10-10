import type { MetadataRoute } from "next";
import { getBrand } from "@/lib/brand";

// PWA manifest — TZ NFR "Moslashuvchanlik" (telefonga ilova kabi o'rnatiladi)
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getBrand();
  return {
    name: `${brand.name} — Boshqaruv tizimi`,
    short_name: brand.name,
    description: "O'quv markazini boshqarish tizimi",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1f47f5",
    lang: "uz",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
