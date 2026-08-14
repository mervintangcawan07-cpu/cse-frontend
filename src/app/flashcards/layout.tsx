import Sidebar from "@/components/Sidebar";

export default function FlashcardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 w-full min-w-0 p-4 sm:p-6 md:p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}