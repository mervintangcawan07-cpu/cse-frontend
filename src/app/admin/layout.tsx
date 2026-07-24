import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    <div className="min-h-screen bg-slate-100/70">
      {/* Persistent Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 border-b border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-extrabold tracking-wider text-amber-400">ADMIN CONTROL CENTER</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 hidden sm:inline">Admin: <strong className="text-white">{user.email}</strong></span>
              <Link
                href="/dashboard"
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 font-bold transition"
              >
                👁️ Exit Admin View
              </Link>
            </div>
          </div>

          {/* Persistent Admin Sub-Navigation */}
          <nav className="flex items-center gap-1 py-2 overflow-x-auto text-xs font-bold">
            <Link
              href="/admin/dashboard"
              className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition whitespace-nowrap"
            >
              📊 Overview & Analytics
            </Link>
            <Link
              href="/admin/questions"
              className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition whitespace-nowrap"
            >
              ❓ Question Bank
            </Link>
            <Link
              href="/admin/users"
              className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition whitespace-nowrap"
            >
              👥 Users & PRO Subscriptions
            </Link>
            <Link
              href="/admin/reviewer"
              className="px-3.5 py-2 rounded-xl text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition whitespace-nowrap"
            >
              📝 Admin Study Notes
            </Link>
            <Link
              href="/admin/reading-materials"
              className="px-3.5 py-2 rounded-xl text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition whitespace-nowrap"
            >
              📚 Admin Handbooks & Docs
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}