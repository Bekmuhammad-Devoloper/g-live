# Ikki raqam (550552277 + 550552022) bir IP'dan — adashmasdan

Uztelecom javobi (2026-09-22): *"Bitta IP'dan bir nechta raqam ishlatish mumkin — ikkala
raqam bitta VLAN'da bo'lsa bo'ldi. Bizning server har raqam uchun alohida trunk ko'taradi;
ikkala raqam autentifikatsiyali bo'lgani uchun Asterisk'da har biri uchun alohida trunk
sozlanishi kerak."*

Shu talabga mos konfig — **bitta Asterisk (eski, 2277 ishlayotgani), bitta IP:port
(10.66.30.204:5060), IKKI alohida trunk**: `uztelecom` (2277, tegilmagan) + `gl2022` (2022, yangi).

## Nega adashmaydi

| Qavat | Mexanizm | Natija |
|---|---|---|
| 1 | `gl2022-registration` da **`line=yes` + `endpoint=gl2022`** — Contact'ga unikal `;line=` parametri qo'shiladi; provayder 2022 uchun kelgan INVITE'ni shu Contact'ga yuboradi | INVITE **IP identify'dan oldin** `gl2022` endpointiga bog'lanadi → `from-trunk-2022` → glive |
| 2 | Zaxira: provayder line'siz yuborsa, INVITE IP bo'yicha `uztelecom` → `from-trunk`; u yerda **`exten => 550552022`** (Request-URI'dagi DID) `_X.` dan ustun | 2022 yana glive'ga, 2277 va boshqalar o'z yo'lida |
| 3 | Chiquvchi: glive → eski Asterisk `from-glive` → `Dial(PJSIP/...@gl2022)`, `from_user=550552022`, `CALLERID=550552022` | Mijozda **2022** ko'rinadi; eski CRM chiquvchisi avvalgidek **2277** |

Avgustdagi urinishlar (bir IP'da ikki port; bir portda ikki reg) provayder tomonida
"oxirgi reg yutadi" bilan tugagan edi. Hozir Uztelecom "alohida trunk" ni **rasman
qo'llab-quvvatlaymiz** dedi — shu sabab qayta sinash mantiqli. Agar yana faqat bittasi
kelsa — bu **provayder tomonidagi sozlama** (ikkala akkauntni bir IP'ga ruxsat berish),
biz tomonda boshqa qiladigan narsa yo'q; pastdagi "Uztelecom'ga xabar" ni yuboring.

## Qo'llash (server A: `ubuntu@89.126.208.123`)

```bash
# 1) loyihadan fayllarni serverga (laptopdan)
scp -i ~/.ssh/gl-tunnel -r deploy/asterisk/dual-trunk ubuntu@89.126.208.123:/tmp/dual-trunk

# 2) serverda
ssh -i ~/.ssh/gl-tunnel ubuntu@89.126.208.123
sudo bash /tmp/dual-trunk/apply.sh
```

`apply.sh` idempotent: zaxira (`/root/asterisk-backup-<vaqt>/`) → eski Asterisk'ga
`#include gl-dual/…` (2 qator) → glive'da o'z registratsiyasini o'chiradi, relay + chiquvchi
trunk → reload → holat. Avgustdagi qoldiq bloklar (`[gl2022-*]`, `exten => 550552022`)
topilsa **to'xtaydi** va ko'rsatadi — avval ularni olib tashlang (zaxira bor).

## Sinov (real telefon bilan, 2–3 marta)

1. 550552277 ga → eski CRM operatori jiringlaydi
2. 550552022 ga → GL EDU (glive) operatori jiringlaydi
3. **Ikkalasiga bir vaqtda** → ikkalasi ham jiringlaydi
4. GL EDU'dan chiquvchi → telefonda 2022; eski CRM'dan → 2277

Kuzatish:
```bash
sudo asterisk -rvvv                                   # eski
sudo asterisk -C /etc/asterisk-glive/asterisk.conf -rvvv   # glive
pjsip set logger on        # INVITE Request-URI/To da qaysi raqam kelayotganini ko'rsatadi
pjsip show registrations   # eski: 2 ta Registered; glive: bo'sh
pjsip show registration gl2022-registration   # Contact'da ;line= bo'lsa 1-qavat ishlayapti
```

Qaytarish: `sudo bash /tmp/dual-trunk/rollback.sh` (2277 hech qachon tegilmaydi).

## Uztelecom'ga xabar (agar 2022 hali ham kelmasa)

> Salom. Biz sizning tavsiyangiz bo'yicha Asterisk'da har raqam uchun alohida,
> autentifikatsiyali trunk sozladik: 550552277 va 550552022 — ikkalasi ham
> 10.66.30.204:5060 dan alohida REGISTER qiladi (alohida Contact, `;line=` parametri
> bilan) va ikkalasi ham sizda "Registered". Iltimos, tekshiring: ikkala akkaunt bitta
> IP (10.66.30.204) uchun ruxsat etilgan bo'lsin va 550552022 ga kelgan qo'ng'iroq INVITE'i
> 550552022 registratsiyasining Contact'iga (yoki hech bo'lmasa Request-URI/To'da
> 550552022 bilan) yuborilsin. Hozir sinovda [nima kuzatilgani].

## Fayllar

- `old-pjsip-2022.conf` — eski Asterisk: `gl2022-auth/registration/aor/endpoint` (line=yes), `gl-newast` ko'prik + identify
- `old-extensions-2022.conf` — `from-trunk-2022`, `from-trunk` dagi DID override, `from-glive` chiquvchi
- `glive-pjsip-relay.conf` — glive: `gl-relay-in` (kiruvchi relay) + `gl-oldast` (chiquvchi relay)
- `apply.sh` / `rollback.sh`
