type BW = { branchId: string } | Record<string, never>;
type BWShared = { OR: ({ branchId: string } | { branchId: null })[] } | Record<string, never>;

export function branchWhere(s: { branchId: string | null }): BW {
  return s.branchId ? { branchId: s.branchId } : {};
}

type BWStaff = { OR: ({ branchId: string } | { branches: { some: { branchId: string } } })[] } | Record<string, never>;

export function staffBranchWhere(s: { branchId: string | null }): BWStaff {
  return s.branchId ? { OR: [{ branchId: s.branchId }, { branches: { some: { branchId: s.branchId } } }] } : {};
}

export function branchWhereShared(s: { branchId: string | null }): BWShared {
  return s.branchId ? { OR: [{ branchId: s.branchId }, { branchId: null }] } : {};
}

export function branchViaStudent(s: { branchId: string | null }): { student: BW } | Record<string, never> {
  return s.branchId ? { student: branchWhere(s) } : {};
}

export function branchViaGroup(s: { branchId: string | null }): { group: BW } | Record<string, never> {
  return s.branchId ? { group: branchWhere(s) } : {};
}

export function branchViaLesson(s: { branchId: string | null }): { lesson: { group: BW } } | Record<string, never> {
  return s.branchId ? { lesson: { group: branchWhere(s) } } : {};
}
