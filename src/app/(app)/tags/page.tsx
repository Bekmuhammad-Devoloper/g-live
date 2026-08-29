import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import CrudTable from "../_components/CrudTable";
import TagsExport from "./TagsExport";
import { saveTag, deleteTag } from "./actions";

const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export default async function TagsPage() {
  const s = await requireSession();
  if (!CAN.includes(s.role as never)) return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management.", de: "Dieser Bereich ist für die Geschäftsleitung." })} />;

  const tags = await prisma.tag.findMany({ orderBy: { createdAt: "asc" } });
  const rows = tags.map((t) => ({ id: t.id, name: t.name, code: t.code ?? "", active: t.isActive ? tr(s.locale, { uz: "Faol", ru: "Активен", en: "Active", de: "Aktiv" }) : tr(s.locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive", de: "Inaktiv" }) }));

  return (
    <div className="space-y-3">
      <TagsExport rows={rows} locale={s.locale} />
      <CrudTable
        title={tr(s.locale, { uz: "Teglar", ru: "Теги", en: "Tags", de: "Tags" })}
        addLabel={tr(s.locale, { uz: "Teg qo'shish", ru: "Добавить тег", en: "Add tag", de: "Tag hinzufügen" })}
        rows={rows}
        canManage={CAN.includes(s.role as never)}
        saveAction={saveTag}
        deleteAction={deleteTag}
        locale={s.locale}
        columns={[
          { key: "name", label: tr(s.locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" }) },
          { key: "code", label: tr(s.locale, { uz: "Kodi", ru: "Код", en: "Code", de: "Code" }) },
          { key: "active", label: tr(s.locale, { uz: "Holati", ru: "Статус", en: "Status", de: "Status" }), align: "center" },
        ]}
        fields={[
          { name: "name", label: tr(s.locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" }), required: true, placeholder: tr(s.locale, { uz: "Teg nomi", ru: "Название тега", en: "Tag name", de: "Tag-Name" }) },
          { name: "code", label: tr(s.locale, { uz: "Kodi", ru: "Код", en: "Code", de: "Code" }), placeholder: tr(s.locale, { uz: "Masalan: VIP", ru: "Например: VIP", en: "e.g. VIP", de: "z. B. VIP" }) },
        ]}
      />
    </div>
  );
}
