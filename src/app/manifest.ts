import type { MetadataRoute } from "next";

// PWA manifest — TZ NFR "Moslashuvchanlik" (telefonga ilova kabi o'rnatiladi)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Germaniya Live — Boshqaruv tizimi",
    short_name: "Germaniya Live",
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
