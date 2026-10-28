import { TeamBoardPage } from "../operators/boardPage";

export default function AdminsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  return <TeamBoardPage kind="admin" searchParams={searchParams} />;
}
