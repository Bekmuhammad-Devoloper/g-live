import { TeamDetailPage } from "./detailPage";

export default function OperatorDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string; date?: string }> }) {
  return <TeamDetailPage kind="operator" {...props} />;
}
