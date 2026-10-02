import { TeamBoardPage } from "../operators/boardPage";

// Filial administratorlari monitoringi — operatorlar bo'limi bilan bir xil sahifa, tur: admin
export default function AdminsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  return <TeamBoardPage kind="admin" searchParams={searchParams} />;
}
