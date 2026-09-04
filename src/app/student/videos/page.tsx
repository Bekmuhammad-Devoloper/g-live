import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { S } from "../_i18n";
import { PageHeader, CARD } from "../_ui";
import { getActiveVideos, videoEmbed, videoThumb } from "@/lib/portalContent";
import VideoItem from "./VideoItem";

// Video va podkastlar — ma'muriyat qo'ygan YouTube materiallari.
// O'quvchi ilovadan chiqmasdan ko'radi.

export default async function StudentVideosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const rows = await getActiveVideos();
  const items = rows.map((v) => ({
    id: v.id,
    title: v.title,
    note: v.note,
    kind: v.kind,
    thumb: videoThumb(v.url),
    embed: videoEmbed(v.url),
    url: v.url,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title={t.videosPodcasts} subtitle={t.learnWithContent} backLabel={t.back} back="/student" />

      {items.length === 0 ? (
        <div className={CARD + " px-5 py-12 text-center"}>
          <div className="text-[15px] font-semibold text-slate-700">{t.noVideosYet}</div>
          <p className="mt-1 text-[13px] text-slate-500">{t.centerAddsSoon}</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {items.map((v) => (
            <VideoItem key={v.id} v={v} openLabel={t.openVideo} />
          ))}
        </div>
      )}
    </div>
  );
}
