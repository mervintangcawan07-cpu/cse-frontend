import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar />
      <main className="flex-1 w-full min-w-0 p-4 sm:p-6 md:p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
