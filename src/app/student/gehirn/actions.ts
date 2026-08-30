"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { NOTE_KINDS, type NoteKind } from "./parse";

// "Ikkinchi miya" — o'quvchining SHAXSIY yozuvlari.
// Har amal faqat o'z yozuvi ustida bajariladi: studentId hamisha sessiyadan
// olinadi va where shartiga qo'shiladi (id ni bilgan begona o'quvchi ham
// birovnikini o'zgartira olmaydi).

export type Res = { ok?: boolean; error?: string; id?: string };

const TITLE_MAX = 120;
const CONTENT_MAX = 20_000;
const NOTES_MAX = 500; // bitta o'quvchi uchun cheklov (baza to'lib ketmasin)

/** Sessiyadagi o'quvchi — yo'q bo'lsa null. */
async function me() {
  const s = await requireSession();
  if (s.role !== ROLES.STUDENT) return null;
  return prisma.student.findUnique({ where: { userId: s.userId }, select: { id: true } });
}

function cleanKind(v: unknown): NoteKind {
  return NOTE_KINDS.includes(v as NoteKind) ? (v as NoteKind) : "NOTE";
}

function refresh() {
  revalidatePath("/student/gehirn");
  revalidatePath("/student/gehirn/graph");
}

/** Yangi yozuv. Sarlavha takrorlansa — oxiriga raqam qo'shiladi. */
export async function createNote(input: { title: string; content?: string; kind?: string }): Promise<Res> {
  const student = await me();
  if (!student) return { error: "forbidden" };

  let title = String(input.title || "").trim().slice(0, TITLE_MAX);
  if (!title) return { error: "empty_title" };
  const content = String(input.content || "").slice(0, CONTENT_MAX);

  const count = await prisma.note.count({ where: { studentId: student.id } });
  if (count >= NOTES_MAX) return { error: "limit" };

  // Sarlavha noyob bo'lishi shart ([[havola]] shu bo'yicha topiladi)
  const taken = await prisma.note.findMany({
    where: { studentId: student.id, title: { startsWith: title } },
    select: { title: true },
  });
  if (taken.some((n) => n.title.toLowerCase() === title.toLowerCase())) {
    let i = 2;
    const base = title;
    const lower = new Set(taken.map((n) => n.title.toLowerCase()));
    while (lower.has(`${base} ${i}`.toLowerCase())) i++;
    title = `${base} ${i}`.slice(0, TITLE_MAX);
  }

  const note = await prisma.note.create({
    data: { studentId: student.id, title, content, kind: cleanKind(input.kind) },
    select: { id: true },
  });
  refresh();
  return { ok: true, id: note.id };
}

/** Mavjud yozuvni saqlash. */
export async function updateNote(
  id: string,
  input: { title?: string; content?: string; kind?: string; tags?: string; pinned?: boolean },
): Promise<Res> {
  const student = await me();
  if (!student) return { error: "forbidden" };

  const own = await prisma.note.findFirst({
    where: { id, studentId: student.id },
    select: { id: true, title: true },
  });
  if (!own) return { error: "not_found" };

  const data: Record<string, unknown> = {};

  if (input.title !== undefined) {
    const title = String(input.title).trim().slice(0, TITLE_MAX);
    if (!title) return { error: "empty_title" };
    if (title.toLowerCase() !== own.title.toLowerCase()) {
      const clash = await prisma.note.findFirst({
        where: { studentId: student.id, title, NOT: { id } },
        select: { id: true },
      });
      if (clash) return { error: "title_taken" };
    }
    data.title = title;
  }
  if (input.content !== undefined) data.content = String(input.content).slice(0, CONTENT_MAX);
  if (input.kind !== undefined) data.kind = cleanKind(input.kind);
  if (input.tags !== undefined) data.tags = String(input.tags).trim().slice(0, 300) || null;
  if (input.pinned !== undefined) data.pinned = !!input.pinned;

  await prisma.note.update({ where: { id }, data });
  refresh();
  revalidatePath(`/student/gehirn/${id}`);
  return { ok: true, id };
}

/** Yozuvni o'chirish. Boshqa yozuvlardagi [[havola]] matnda qoladi — u
 *  "hali yaratilmagan" tugunga aylanadi (Obsidian ham shunday qiladi). */
export async function deleteNote(id: string): Promise<Res> {
  const student = await me();
  if (!student) return { error: "forbidden" };

  const r = await prisma.note.deleteMany({ where: { id, studentId: student.id } });
  if (r.count === 0) return { error: "not_found" };
  refresh();
  return { ok: true };
}

/** Grafda "hali yo'q" tugun bosilganda — o'sha nom bilan yozuv ochish. */
export async function createFromLink(title: string): Promise<Res> {
  return createNote({ title });
}
