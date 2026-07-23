import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import UpgradeButton from "@/components/UpgradeButton";

export default async function ExamPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("cse_session")?.value;

  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    redirect("/login");
  }

  // Safely extract properties to prevent TypeScript compiler errors
  const userRecord = user as any;
  const isPaidUser = Boolean(userRecord?.isPaid);
  const isAdmin = userRecord?.role === "ADMIN";
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

        {hasAccess ? (
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl space-y-6">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
              <h2 className="text-xl font-bold text-emerald-900">
                Premium Questions Unlocked
              </h2>
              <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full">
                {isAdmin ? "Admin Access" : "Premium Member"}
              </span>
            </div>

            <div className="bg-white p-6 rounded-xl border border-emerald-100 shadow-sm">
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md">
                Question 2 of 500
              </span>
              <h3 className="text-lg font-medium text-slate-800 mt-3">
                {sampleQuestions[1].question}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {sampleQuestions[1].options.map((option, idx) => (
                  <button
                    key={idx}
                    className="text-left px-4 py-2.5 border rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition"
                  >
                    {option}
                  </button>
                ))}
              </div>
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