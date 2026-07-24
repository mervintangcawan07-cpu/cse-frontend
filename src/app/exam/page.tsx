import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import UpgradeButton from "@/components/UpgradeButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ExamPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;

  if (!token) {
    redirect("/login");
  }

  // 💡 FIX: Safely verify and decode the JWT token to get the real userId
  const session = await verifyJWT(token);
  if (!session?.userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: String(session.userId) },
  });

  if (!user) {
    redirect("/login");
  }

  const isPaidUser = Boolean(user.isPaid);
  const isAdmin = user.role === "ADMIN";
  const hasAccess = isPaidUser || isAdmin;

  const sampleQuestions = [
    {
      id: 1,
      question: "Which word is a synonym for 'Ephemeral'?",
      options: ["A. Permanent", "B. Fleeting", "C. Substantial", "D. Eternal"],
      answer: "B. Fleeting",
    },
    {
      id: 2,
      question: "Solve for x: 3x + 15 = 45",
      options: ["A. 10", "B. 15", "C. 5", "D. 20"],
      answer: "A. 10",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-800">
          Civil Service Mock Exam Reviewer
        </h1>
        <p className="text-slate-600 mt-1">
          Welcome back, <span className="font-semibold text-slate-900">{user.email}</span>!
        </p>
      </div>

      <div className="space-y-6">
        {/* Sample Question Box */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
            Free Sample Question
          </span>
          <h3 className="text-lg font-medium text-slate-800 mt-3">
            {sampleQuestions[0].question}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {sampleQuestions[0].options.map((option, idx) => (
              <button
                key={idx}
                className="text-left px-4 py-2.5 border rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition"
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Access Section */}
        {hasAccess ? (
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl space-y-6">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
              <div>
                <h2 className="text-xl font-bold text-emerald-900">
                  Full Mock Exam Ready
                </h2>
                <p className="text-xs text-emerald-700 mt-0.5">
                  You have full access to all categories and interactive exam modes.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full">
                {isAdmin ? "Admin Access" : "Premium Member"}
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Interactive Practice Test
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Start a timed or untimed practice exam with instant scoring.
                </p>
              </div>
              <Link
                href="/mock-exam/take"
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl text-center transition shadow-sm"
              >
                Launch Mock Exam &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-8 text-center text-white shadow-xl">
            <div className="max-w-md mx-auto space-y-4">
              <div className="inline-flex p-3 bg-blue-600/20 text-blue-400 rounded-full mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-bold">Unlock Full CSE Mock Exam Access</h2>
              <p className="text-slate-300 text-sm">
                Get lifetime access to 500+ updated Civil Service Exam questions, full answer keys, and detailed explanations.
              </p>

              <div className="pt-4">
                <UpgradeButton
                  userId={user.id}
                  email={user.email}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}