// Faol filial bo'yicha ro'yxat filtri (2026-08-23 talab: filial almashtirilganda
// boshqa filialning yozuvlari ko'rinmasin).
//
// Qoida: sessiyada faol filial bo'lsa — o'sha filial yozuvlari KO'RSATILADI,
// filialga biriktirilmagan (branchId=null) eski yozuvlar ham ko'rinadi
// (aks holda ular hech qaysi filialda chiqmay "yo'qolib" qolardi).
// Sessiyada filial bo'lmasa — hammasi ko'rinadi.
export function branchWhere(s: { branchId: string | null }): { OR: ({ branchId: string } | { branchId: null })[] } | Record<string, never> {
  return s.branchId ? { OR: [{ branchId: s.branchId }, { branchId: null }] } : {};
}
