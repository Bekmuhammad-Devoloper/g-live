# GL-EDU telefoniya (Asterisk + WebRTC softphone)

O'z-serverli **Asterisk 18+** PBX orqali operator/ROP uchun brauzer softphone,
qo'ng'iroq yozuvi va sticky routing. Ilova tomoni GL-EDU (Next.js + Prisma)'ga
moslangan (spec'dagi NestJS o'rniga).

## Arxitektura
```
Operator brauzer (JsSIP, WSS)  ──►  Asterisk (pjsip)  ──►  SIP trunk (Uztelecom)
        ▲                                  │
        │ /api/telephony/webrtc-config     │ AMI (5038)
        ▼                                  ▼
   GL-EDU (Next.js)  ◄── scripts/ami-worker.mjs (AMI hodisa → Call jadvali)
```

## Ilova tomoni (allaqachon qo'shildi)
- `src/lib/asterisk.ts` — webrtc-config, AMI Originate, raqam normalize.
- `GET  /api/telephony/webrtc-config` — operator SIP ext+parol+STUN/TURN (sessiya + 5/min limit).
- `POST /api/telephony/originate` — click-to-call (AMI Originate) + Call yozuvi.
- `GET  /api/telephony/route-lookup?phone=` — sticky routing (dialplan CURL, oddiy matn).
- `GET  /api/telephony/recordings/[file]` — .wav uzatish (Range/206).
- `src/app/(app)/_components/Softphone.tsx` — suzuvchi softphone (register, terma, kiruvchi/chiquvchi, mute/hold/DTMF), operator/ROP/admin rollariga layout'da ulangan.
- `scripts/ami-worker.mjs` — doimiy AMI listener → qo'ng'iroqlarni Call jadvaliga yozadi.
- `User.sipExtension` — operatorning SIP extension'i ("operator3").

Ishga tushirish (backend yonida):
```
node --env-file=.env scripts/ami-worker.mjs
```

## Server (bir martalik) — checklist
- [ ] Provayderdan SIP trunk: USERNAME / PASSWORD / SERVER_IP.
- [ ] Domen + Let's Encrypt sertifikat.
- [ ] Kuchli tasodifiy qiymatlar: AMI_PASS, SIP_OPERATOR{1..N}_PASS (20+ belgi), TURN_CREDENTIAL.
- [ ] `apt install asterisk coturn nginx`; DTLS kalit (`/etc/asterisk/keys/`).
- [ ] Ushbu papkadagi `.conf` fayllarni joylashtiring (`{{...}}` larni almashtiring):
      pjsip / extensions / queues / manager / http / rtp → `/etc/asterisk/`,
      turnserver → `/etc/turnserver.conf`, nginx → `/etc/nginx/sites-*`.
- [ ] `.env.telephony.example` dagi qiymatlarni loyiha `.env` iga qo'shing.
- [ ] Firewall: 5060/udp, 10000-20000/udp, 8089/tcp, 3478/udp+tcp, 49152-65535/udp, 443/tcp. **5038 (AMI) faqat loopback!**
- [ ] `systemctl restart asterisk coturn nginx`.
- [ ] Har operator uchun: `pjsip.conf` da endpoint bloki + `User.sipExtension="operatorN"` + `SIP_OPERATOR{N}_PASS`.
- [ ] `node --env-file=.env scripts/ami-worker.mjs` ni ishga tushiring (pm2/systemd).

## Test
- [ ] Trunk: `asterisk -rvvv` → `pjsip show registrations` (Registered).
- [ ] Operator login → softphone yashil (Ulangan) → `pjsip show endpoints`.
- [ ] Chiquvchi: softphone terma yoki lidda "Qo'ng'iroq" → mijoz jiringlaydi.
- [ ] Kiruvchi: trunk raqamiga qo'ng'iroq → sticky/queue operatorga tushadi.
- [ ] Yozuv: tugagach `/api/telephony/recordings/<file>.wav` ochiladi.

## Xavfsizlik
- AMI 5038 hech qachon ochiq emas (loopback/whitelist).
- SIP parollar 20+ belgi, har operatorga unikal; choraklik almashtiring.
- `webrtc-config` — sessiya + rate-limit (parol qaytaradi).
- fail2ban Asterisk jail; yozuvlar PII bo'lishi mumkin — fayl kirishini cheklang.
- Prod'da faqat WSS (brauzerdan plain WS emas).
