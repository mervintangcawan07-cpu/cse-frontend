import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SudoProvider } from "@/context/SudoContext";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;

  if (!token) redirect("/login");

  const session = await verifyJWT(token);
  if (!session?.userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { role: true, email: true },
  });

  if (user?.role !== "ADMIN") redirect("/dashboard");

  return (
    <SudoProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Persistent Admin Header */}
        <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white sticky top-0 z-50 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Top Meta Header */}
            <div className="flex items-center justify-between h-14 border-b border-slate-800/80 text-xs gap-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-black tracking-wider text-amber-400 uppercase">
                  ADMIN CONTROL CENTER
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-400 hidden md:inline text-[11px]">
                  Admin: <strong className="text-white font-mono">{user.email}</strong>
                </span>
                <Link
                  href="/dashboard"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 font-extrabold transition text-[11px] flex items-center gap-1.5 shadow-sm"
                >
                  <span>👁️</span>
                  <span>Exit Admin View</span>
                </Link>
              </div>
            </div>

            {/* Persistent Admin Sub-Navigation */}
            <nav className="flex items-center gap-1.5 py-2.5 overflow-x-auto text-xs font-bold scrollbar-none">
              <Link
                href="/admin/dashboard"
                className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition whitespace-nowrap flex items-center gap-1.5"
              >
                <span>📊</span> Overview & Analytics
              </Link>

              <Link
                href="/admin/health"
                className="px-3.5 py-2 rounded-xl text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition whitespace-nowrap flex items-center gap-1.5 font-black shadow-sm"
              >
                <span className="text-sm">💓</span> System Health
              </Link>

              <Link
                href="/admin/elimination-drills"
                className="px-3.5 py-2 rounded-xl text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition whitespace-nowrap flex items-center gap-1.5 font-black shadow-sm"
              >
                <span className="text-sm">⚡</span> Elimination Drills
              </Link>

              <Link
                href="/admin/questions"
                className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition whitespace-nowrap flex items-center gap-1.5"
              >
                <span>❓</span> Questions
              </Link>

              <Link
                href="/admin/users"
                className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition whitespace-nowrap flex items-center gap-1.5"
              >
                <span>👥</span> Users
              </Link>

              <Link
                href="/admin/trash"
                className="px-3.5 py-2 rounded-xl text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition whitespace-nowrap flex items-center gap-1.5 font-black shadow-sm"
              >
                <span>🗑️</span> Trash Bin
              </Link>

              <Link
                href="/admin/flashcards"
                className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition whitespace-nowrap flex items-center gap-1.5"
              >
                <span>🎴</span> Flashcards
              </Link>

              <Link
                href="/admin/csc-sync"
                className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition whitespace-nowrap flex items-center gap-1.5"
              >
                <span>🔄</span> CSC Sync
              </Link>

              <Link
                href="/admin/system"
                className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition whitespace-nowrap flex items-center gap-1.5"
              >
                <span>⚙️</span> System Config
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </SudoProvider>
  );
}
