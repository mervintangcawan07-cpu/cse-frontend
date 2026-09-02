import Sidebar from "@/components/Sidebar";

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar />
      <main className="flex-1 w-full min-w-0 p-4 sm:p-6 md:p-12 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}