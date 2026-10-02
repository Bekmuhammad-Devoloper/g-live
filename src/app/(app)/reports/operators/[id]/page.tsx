import { TeamDetailPage } from "./detailPage";

// Operator profili — umumiy jamoa profili (detailPage.tsx), tur: operator
export default function OperatorDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string; date?: string }> }) {
  return <TeamDetailPage kind="operator" {...props} />;
}
