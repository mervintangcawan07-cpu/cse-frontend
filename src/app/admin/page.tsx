import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import Link from "next/link";

async function getAdminData() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;

  if (!token) return null;
  const session = await verifyJWT(token);
  if (session?.role !== "ADMIN") return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${appUrl}/api/admin/analytics`, {
    headers: { Cookie: `cse_session=${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;

  if (!token) redirect("/login");
  const session = await verifyJWT(token);
  if (session?.role !== "ADMIN") redirect("/dashboard");

  const analytics = await getAdminData();

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900">Admin Control Center</h1>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full">
                ADMIN
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              System health, PayMongo subscription revenue, and platform analytics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/questions"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shadow-sm"
            >
              Manage Questions
            </Link>
            <Link
              href="/admin/reading"
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition shadow-sm"
            >
              Manage Notes
            </Link>
          </div>
        </div>

        {/* High Level Platform Metrics */}
        {analytics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Registered</p>
              <p className="text-3xl font-extrabold text-slate-900">{analytics.totalUsers}</p>
              <p className="text-xs text-slate-500">{analytics.paidUsers} PRO Members</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Revenue</p>
              <p className="text-3xl font-extrabold text-emerald-600">₱{analytics.estimatedRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500">From ₱499 PayMongo activations</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exams Completed</p>
              <p className="text-3xl font-extrabold text-blue-600">{analytics.totalExamsTaken}</p>
              <p className="text-xs text-slate-500">Platform-wide attempts</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Pass Rate</p>
              <p className="text-3xl font-extrabold text-indigo-600">{analytics.overallPassRate}%</p>
              <p className="text-xs text-slate-500">Examinees scoring &ge; 80%</p>
            </div>
          </div>
        ) : (
          <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-500 text-sm">
            Loading system analytics data...
          </div>
        )}

        {/* System Management Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/questions"
            className="p-6 bg-white rounded-3xl border border-slate-200 hover:border-blue-400 transition shadow-sm space-y-2 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-2xl">📝</span>
              <span className="text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                Open Manager &rarr;
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Question Bank Manager</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Create, update, or remove examination questions, answer keys, and explanations.
            </p>
          </Link>

          <Link
            href="/admin/reading"
            className="p-6 bg-white rounded-3xl border border-slate-200 hover:border-indigo-400 transition shadow-sm space-y-2 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-2xl">📚</span>
              <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                Open Manager &rarr;
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Reading Materials Manager</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Publish study notes, cheat sheets, and set PRO membership lock conditions.
            </p>
          </Link>

          <Link
            href="/admin/users"
            className="p-6 bg-white rounded-3xl border border-slate-200 hover:border-emerald-400 transition shadow-sm space-y-2 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-2xl">👥</span>
              <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
                Open Roster &rarr;
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">User Roster & Roles</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Inspect examinee registration dates, payment statuses, and system roles.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}