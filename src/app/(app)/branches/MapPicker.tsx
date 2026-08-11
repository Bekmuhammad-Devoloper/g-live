"use client";

import { useEffect, useRef } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const TASHKENT: [number, number] = [41.3111, 69.2797];

// Leaflet'ni CDN orqali bir marta yuklaydi
function ensureLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css"; link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    if (w.L) return resolve(w.L);
    let sc = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (sc) { sc.addEventListener("load", () => resolve(w.L)); return; }
    sc = document.createElement("script");
    sc.id = "leaflet-js"; sc.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    sc.onload = () => resolve(w.L); sc.onerror = reject;
    document.body.appendChild(sc);
  });
}

export default function MapPicker({ lat, lng, radius, onChange }: { lat: number | null; lng: number | null; radius: number; onChange: (lat: number, lng: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const store = useRef<any>({});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    ensureLeaflet().then((L) => {
      if (cancelled || !el.current || store.current.map) return;
      // default marker ikonkalarini CDN'ga bog'lash (aks holda 404)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const start: [number, number] = [lat ?? TASHKENT[0], lng ?? TASHKENT[1]];
      const map = L.map(el.current).setView(start, 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
      const marker = L.marker(start, { draggable: true }).addTo(map);
      const circle = L.circle(start, { radius: radius || 100, color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 2 }).addTo(map);
      const set = (ll: any) => { marker.setLatLng(ll); circle.setLatLng(ll); onChangeRef.current(ll.lat, ll.lng); };
      marker.on("dragend", () => set(marker.getLatLng()));
      map.on("click", (e: any) => set(e.latlng));
      store.current = { map, marker, circle };
      setTimeout(() => map.invalidateSize(), 300); // drawer animatsiyasidan keyin
    }).catch(() => {});
    return () => { cancelled = true; if (store.current.map) { store.current.map.remove(); store.current = {}; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // radius o'zgarsa doirani yangilash
  useEffect(() => { if (store.current.circle) store.current.circle.setRadius(radius || 100); }, [radius]);
  // tashqaridan lat/lng o'zgarsa (masalan qo'lda kiritilса) markerni ko'chirish
  useEffect(() => {
    if (store.current.marker && lat != null && lng != null) {
      const cur = store.current.marker.getLatLng();
      if (Math.abs(cur.lat - lat) > 1e-9 || Math.abs(cur.lng - lng) > 1e-9) {
        store.current.marker.setLatLng([lat, lng]); store.current.circle.setLatLng([lat, lng]);
      }
    }
  }, [lat, lng]);

  return <div ref={el} className="h-[340px] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700" />;
}
