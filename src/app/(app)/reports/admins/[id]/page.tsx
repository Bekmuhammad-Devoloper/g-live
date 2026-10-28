import { TeamDetailPage } from "../../operators/[id]/detailPage";

export default function AdminDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string; date?: string }> }) {
  return <TeamDetailPage kind="admin" {...props} />;
}
