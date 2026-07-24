import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import ReviewCenter from "@/components/dashboard/ReviewCenter";
import AnalyticsOverview from "@/components/dashboard/AnalyticsOverview";
import UpgradeButton from "@/components/UpgradeButton";

// 💡 Force dynamic rendering so Vercel never serves stale cached HTML
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface DashboardProps {
  searchParams: Promise<{ payment?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;

  if (!token) redirect("/login");

  const session = await verifyJWT(token);
  if (!session?.userId) redirect("/login");

  // 1. Fetch live user data from Neon DB
  let user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      results: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) redirect("/login");

  // 2. FAIL-SAFE SYNC: If user returns from PayMongo with ?payment=success but webhook is delayed
  if (params.payment === "success" && !user.isPaid) {
    try {
      user = await prisma.user.update({
        where: { id: session.userId },
        data: { isPaid: true },
        include: {
          results: { orderBy: { createdAt: "desc" } },
        },
      });
      console.log(`[Dashboard Auto-Sync] User ${user.id} upgraded to PRO via payment callback.`);
    } catch (err) {
      console.error("[Dashboard Auto-Sync Error]:", err);
    }
  }

  const userRecord = user as {
    id: string;
    email: string;
    name?: string | null;
    isPaid: boolean;
    results: Array<{
      id: string;
      score: number;
      correct: number;
      incorrect: number;
      totalItems: number;
      createdAt: Date;
    }>;
  };

  const results = userRecord.results || [];
  const isPaid = Boolean(userRecord.isPaid);

  // Calculate analytics metrics server-side
  const totalExams = results.length;
  const avgScore =
    totalExams > 0 ? Math.round(results.reduce((acc, r) => acc + r.score, 0) / totalExams) : 0;
  const highestScore = totalExams > 0 ? Math.max(...results.map((r) => r.score)) : 0;
  const passedCount = results.filter((r) => r.score >= 80).length;
  const readinessIndex = totalExams > 0 ? Math.round((passedCount / totalExams) * 100) : 0;

  const formattedResults = results.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Banner Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
          <div className="space-y-2 max-w-xl z-10">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight">
                Welcome, {userRecord.name || userRecord.email}!
              </h1>
              {isPaid ? (
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
                  PRO MEMBER
                </span>
              ) : (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full border border-amber-500/30">
                  PAYMENT REQUIRED
                </span>
              )}
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              {isPaid
                ? "Track your Civil Service Exam preparation progress and readiness analytics."
                : "Complete your one-time registration payment to access full reviewer features."}
            </p>
          </div>
        </div>

        {/* PAYMONGO PAYMENT GATEWAY FOR UNPAID USERS */}
        {!isPaid ? (
          <div className="bg-white rounded-3xl p-8 md:p-12 text-center shadow-xl space-y-8 max-w-3xl mx-auto border border-slate-200/80">
            <div className="inline-flex p-5 bg-blue-50 text-blue-600 rounded-3xl border border-blue-100 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold text-slate-900">Unlock Full Reviewer Access</h2>
              <p className="text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">
                Payment is required via PayMongo before accessing full dashboard contents, analytics, mock exams, and PRO study guides.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto text-xs text-slate-700 bg-slate-50 p-5 rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>500+ CSE Practice Questions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Instant Answer Explanations</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Real-Time Analytics & Index</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Lifetime Mobile & Desktop Access</span>
              </div>
            </div>

            <div className="pt-2">
              <UpgradeButton userId={userRecord.id} email={userRecord.email} />
            </div>
          </div>
        ) : (
          /* UNLOCKED DASHBOARD CONTENT FOR PRO MEMBERS */
          <div className="space-y-8">
            <ReviewCenter />
            <AnalyticsOverview
              totalExams={totalExams}
              avgScore={avgScore}
              highestScore={highestScore}
              readinessIndex={readinessIndex}
              results={formattedResults}
            />
          </div>
        )}
      </div>
    </div>
  );
}