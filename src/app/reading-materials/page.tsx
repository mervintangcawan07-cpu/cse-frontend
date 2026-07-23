import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import Link from "next/link";

export default async function ReadingMaterialsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;

  if (!token) redirect("/login");

  const session = await verifyJWT(token);
  if (!session?.userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isPaid: true },
  });

  const isPaid = Boolean(user?.isPaid);

  // Fetch all reading materials from Neon DB (use raw query in case model name differs)
  const materials = (await prisma.$queryRaw<any[]>`
    SELECT * FROM "ReadingMaterial" ORDER BY "createdAt" DESC
  `) || [];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Study Notes & Reading Materials</h1>
            <p className="text-slate-500 text-sm mt-1">
              Civil Service Exam review materials, formulas, and grammar cheat sheets.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        {materials.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
            <p className="text-slate-500 text-sm font-medium">No study materials published yet.</p>
            <p className="text-xs text-slate-400">Check back later for updated review guides.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {materials.map((item) => {
              const isLocked = item.isPremium && !isPaid;

              return (
                <div
                  key={item.id}
                  className={`bg-white p-6 rounded-3xl border ${
                    isLocked ? "border-amber-200 bg-amber-50/20" : "border-slate-200"
                  } shadow-sm space-y-3 relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                      {item.category}
                    </span>
                    {item.isPremium && (
                      <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
                        PRO EXCLUSIVE
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>

                  {isLocked ? (
                    <div className="p-6 bg-slate-900 text-white rounded-2xl text-center space-y-3 my-2">
                      <p className="text-sm font-semibold">🔒 Premium Study Guide Locked</p>
                      <p className="text-xs text-slate-300">
                        Upgrade your account to unlock full lifetime access to all PRO review materials.
                      </p>
                      <Link
                        href="/dashboard"
                        className="inline-block bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold px-6 py-2.5 rounded-xl transition"
                      >
                        Upgrade Account
                      </Link>
                    </div>
                  ) : (
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}