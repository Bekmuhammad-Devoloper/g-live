import LogoLoader from "./_components/LogoLoader";

export default function AppLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center" aria-busy="true">
      <LogoLoader />
    </div>
  );
}
