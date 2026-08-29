// Relative Path: src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { SudoProvider } from "@/context/SudoContext";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <SudoProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Categorized Sticky Top Navigation Bar */}
        <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
              <Link href="/admin" className="flex items-center gap-2 font-bold text-white hover:text-emerald-400 transition">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
                  🛡️
                </span>
                <span>Admin Command Center</span>
              </Link>
            </div>

            {/* Quick Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
              <Link
                href="/admin"
                className="px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition"
              >
                Hub
              </Link>
              <div className="h-4 w-px bg-slate-800 my-auto"></div>
              
              <span className="text-[10px] text-slate-500 uppercase tracking-wider px-1.5">Ops:</span>
              <Link
                href="/admin/backups"
                className="px-2 py-1.5 rounded-md hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition"
              >
                Backups
              </Link>
              <Link
                href="/admin/health"
                className="px-2 py-1.5 rounded-md hover:bg-slate-800 text-sky-400 hover:text-sky-300 transition"
              >
                Health
              </Link>
              <Link
                href="/admin/system"
                className="px-2 py-1.5 rounded-md hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition"
              >
                Config
              </Link>

              <div className="h-4 w-px bg-slate-800 my-auto"></div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider px-1.5">Academic:</span>
              <Link
                href="/admin/questions"
                className="px-2 py-1.5 rounded-md hover:bg-slate-800 text-purple-400 hover:text-purple-300 transition"
              >
                Questions
              </Link>
              <Link
                href="/admin/elimination-drills"
                className="px-2 py-1.5 rounded-md hover:bg-slate-800 text-amber-400 hover:text-amber-300 transition"
              >
                Drills
              </Link>
              <Link
                href="/admin/users"
                className="px-2 py-1.5 rounded-md hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 transition"
              >
                Examinees
              </Link>
              <Link
                href="/admin/referrals"
                className="px-2 py-1.5 rounded-md hover:bg-slate-800 text-pink-400 hover:text-pink-300 transition font-bold"
              >
                Referrals 🎁
              </Link>
              <Link
                href="/admin/accounting"
                className="px-2 py-1.5 rounded-md hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition font-bold"
              >
                Accounting 📊
              </Link>
            </nav>

            {/* Exit Button */}
            <Link
              href="/dashboard"
              className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg transition"
            >
              Exit to Student App ➔
            </Link>
          </div>
        </header>

        {/* Viewport */}
        <main>{children}</main>
      </div>
    </SudoProvider>
  );
}
