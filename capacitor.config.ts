import type { CapacitorConfig } from "@capacitor/cli";

// Android ilovasi (Capacitor).
//
// NEGA TWA emas: TWA — Chrome oynasi. Qamrovdan chiqilsa manzil qatori
// chiqarardi, push bildirishnoma bermasdi va ekranni boshqarib bo'lmasdi.
// Capacitor'da esa oyna butunlay bizniki: brauzer belgilari umuman yo'q.
//
// NEGA mazmun saytdan olinadi: ilova Next.js server komponentlari va
// ma'lumotlar bazasiga tayanadi — uni telefon ichiga "static" qilib
// joylab bo'lmaydi. Shu sabab qobiq — native, mazmun — germaniya.live dan.
// Bu saytga qo'shilgan har bir yangilik ilovada darhol ko'rinishini ham
// anglatadi: APK ni faqat qobiq o'zgarganda qayta tarqatamiz.
//
// DIQQAT: `appId` TWA dagi bilan bir xil va imzo kaliti ham o'sha
// (`/opt/gl-edu/apk/android.keystore`). Shu ikkisi bir xil bo'lgani uchun
// yangi ilova eskisining USTIGA o'rnatiladi — o'quvchi eskisini o'chirib
// o'tirmaydi. Ikkovidan birini o'zgartirish "boshqa ilova" degani.

const config: CapacitorConfig = {
  appId: "live.germaniya.app",
  appName: "Germaniya Live",

  // Mazmun saytdan kelgani uchun bu papka ish vaqtida ishlatilmaydi, lekin
  // Capacitor uning mavjudligini talab qiladi. Ichida tarmoq uzilganda
  // ko'rsatiladigan sahifa turadi (`errorPath`).
  webDir: "capacitor/www",

  server: {
    url: "https://germaniya.live/student",
    androidScheme: "https",
    // Shifrlanmagan http ga tushib qolmaslik uchun
    cleartext: false,
    // Sayt ochilmasa oq ekran o'rniga tushunarli sahifa
    errorPath: "error.html",
  },

  android: {
    // Sayt HTTPS — aralash mazmunga yo'l qo'ymaymiz
    allowMixedContent: false,
    // Kirish maydonlarida native klaviatura to'g'ri ishlashi uchun
    captureInput: true,
    // Ishlab chiqarish ilovasida WebView'ni tashqaridan tekshirib
    // bo'lmasin (chrome://inspect orqali o'quvchi seansiga kirish yo'li)
    webContentsDebuggingEnabled: false,
    backgroundColor: "#e4edf3",
  },

  // User-Agent ga "GermaniyaLiveApp/<versiya>" qo'shimchasi bu yerda EMAS,
  // MainActivity.java da qo'shiladi: u yerda versiya APK ning o'zidan
  // o'qiladi va har yig'ishda o'zi yangilanadi. Bu yerda yozilsa qo'lda
  // yangilab yurish kerak bo'lardi va server jurnalida hamma versiya bir
  // xil ko'rinardi (aynan shu bo'ldi: "2.0" deb qotib qolgan edi).

  plugins: {
    SplashScreen: {
      // Sayt yuklanib bo'lgach kodning o'zi yopadi (`hide()`), shuning
      // uchun avtomatik yopilish uzoqroq — sekin internetda oq ekran
      // ko'rinib qolmasin.
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#0b3c4d",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      spinnerColor: "#ffffff",
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      // Holat qatori ilovaning to'q ko'k sarlavhasiga qo'shilib ketsin
      style: "DARK",
      backgroundColor: "#0b3c4d",
      overlaysWebView: false,
    },
    Keyboard: {
      // Klaviatura ochilganda sahifa siqilsin (kirish maydoni ko'rinib tursin)
      resize: "native",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
