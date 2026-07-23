import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminUsersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;

  if (!token) {
    redirect("/login");
  }

  // Fetch registered accounts directly from Neon DB using the adapter singleton
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isPaid: true,
      createdAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">User Management</h1>
            <p className="text-slate-500 text-sm mt-1">
              View registered examinees and administrator accounts in Neon DB.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/admin/questions" className="text-blue-600 hover:underline">
              Questions
            </Link>
            <Link href="/admin/reading" className="text-blue-600 hover:underline">
              Reading Modules
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900">Total Users ({users.length})</h2>
            <span className="text-xs text-slate-400">Synced with Neon DB</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase rounded-xl">
                <tr>
                  <th className="p-3 rounded-l-xl">Email</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Subscription</th>
                  <th className="p-3 rounded-r-xl">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 font-semibold text-slate-800">{u.email}</td>
                    <td className="p-3 text-slate-600">{u.name || "N/A"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                          u.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.isPaid ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-md">
                          PRO MEMBER
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-md">
                          UNPAID
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}