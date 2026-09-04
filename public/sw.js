// Eng sodda xizmat ishchisi (service worker).
//
// Vazifasi — ilovani "o'rnatiladigan" qilish va tarmoq uzilganda oq ekran
// o'rniga tushunarli sahifa ko'rsatish. Sahifalarni KESHLAMAYDI: CRM
// ma'lumotlari doim yangi bo'lishi kerak, eski nusxa ko'rsatilsa chalkashlik
// chiqadi. Faqat ikonka va shrift kabi o'zgarmas fayllar keshlanadi.

const CACHE = "gl-static-v2";
const STATIC = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/logo.png",
  // Shrift ilova bilan birga keladi. Keshda bo'lsa ikkinchi ochilishda
  // matn darhol o'z shriftida chiziladi — zaxira shriftdan "sakrash" yo'q.
  "/fonts/inter-latin.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // O'zgarmas fayllar — avval keshdan
  if (/^\/(icons|fonts|_next\/static)\//.test(url.pathname) || url.pathname === "/logo.png") {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ?? fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }),
      ),
    );
    return;
  }

  // Qolgani — doim tarmoqdan
  e.respondWith(fetch(req).catch(() => caches.match(req).then((h) => h ?? Response.error())));
});
