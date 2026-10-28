import { TeamBoardPage } from "./boardPage";

export default function OperatorsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  return <TeamBoardPage kind="operator" searchParams={searchParams} />;
}
