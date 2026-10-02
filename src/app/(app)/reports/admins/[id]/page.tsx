import { TeamDetailPage } from "../../operators/[id]/detailPage";

// Administrator profili — operator profili bilan bir xil sahifa, tur: admin
export default function AdminDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string; date?: string }> }) {
  return <TeamDetailPage kind="admin" {...props} />;
}
