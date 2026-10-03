import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function DashboardShell({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 xl:flex xl:flex-row">
      <Sidebar />

      <main className="min-h-dvh w-full min-w-0 flex-1 overflow-x-hidden p-0">
        {children}
      </main>
    </div>
  );
}
