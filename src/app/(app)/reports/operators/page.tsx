import { TeamBoardPage } from "./boardPage";

// Operatorlar monitoringi — umumiy jamoa sahifasi (boardPage.tsx), tur: operator
export default function OperatorsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  return <TeamBoardPage kind="operator" searchParams={searchParams} />;
}
