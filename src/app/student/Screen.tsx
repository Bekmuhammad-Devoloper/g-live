"use client";

import { usePathname } from "next/navigation";

export default function Screen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="gl-screen">
      {children}
    </div>
  );
}
