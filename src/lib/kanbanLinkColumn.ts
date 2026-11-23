import "server-only";
import { getSetting } from "./settings";

export const KANBAN_COLUMNS_KEY = "crm.kanbanColumns";

export async function linkColumnId(linkId: string): Promise<string | null> {
  try {
    const arr = JSON.parse((await getSetting(KANBAN_COLUMNS_KEY)) || "[]");
    if (!Array.isArray(arr)) return null;
    const col = arr.find((x) => x && typeof x.id === "string" && x.linkId === linkId);
    return col ? String(col.id) : null;
  } catch {
    return null;
  }
}
