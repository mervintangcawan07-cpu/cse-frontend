"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CancelExamModalProps {
  isOpen: boolean;
  onClose: () => void; // Resume exam
  attemptId: string;
  userAnswers: Record<string, number>;
  timeRemaining: number;
  currentQuestionIndex: number;
}

export default function CancelExamModal({
  isOpen,
  onClose,
  attemptId,
  userAnswers,
  timeRemaining,
  currentQuestionIndex,
}: CancelExamModalProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"SAVE" | "END" | null>(null);

  if (!isOpen) return null;

  const handleAction = async (action: "SAVE_FOR_LATER" | "END_EXAM") => {
    setLoadingAction(action === "SAVE_FOR_LATER" ? "SAVE" : "END");

    try {
      const res = await fetch("/api/exam/pause-or-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          action,
          answers: userAnswers,
          timeRemaining,
          currentQuestionIndex,
        }),
      });

      if (res.ok) {
        router.push("/dashboard"); // Redirect to dashboard
      } else {
        const data = await res.json();
        alert(data.error || "Failed to process request.");
        setLoadingAction(null);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred. Please try again.");
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl mx-auto">
            ⏸️
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Pause or Exit Exam?
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Your timer is currently paused. What would you like to do with your exam attempt?
          </p>
        </div>

        {/* Options Stack */}
        <div className="space-y-3">
          {/* Option 1: Save & Resume Later */}
          <button
            onClick={() => handleAction("SAVE_FOR_LATER")}
            disabled={loadingAction !== null}
            className="w-full p-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-2xl transition shadow-md flex items-center justify-between group disabled:opacity-50"
          >
            <div className="text-left">
              <p className="font-extrabold">💾 Save for Later</p>
              <p className="text-[11px] text-blue-100 font-normal">
                Save current progress & time. Come back anytime.
              </p>
            </div>
            <span>{loadingAction === "SAVE" ? "Saving..." : "→"}</span>
          </button>

          {/* Option 2: End Exam (Discard/Cancel) */}
          <button
            onClick={() => handleAction("END_EXAM")}
            disabled={loadingAction !== null}
            className="w-full p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-sm rounded-2xl transition flex items-center justify-between group disabled:opacity-50"
          >
            <div className="text-left">
              <p className="font-extrabold">🛑 End Exam Completely</p>
              <p className="text-[11px] text-rose-500 font-normal">
                Discard progress and mark attempt as cancelled.
              </p>
            </div>
            <span>{loadingAction === "END" ? "Ending..." : "→"}</span>
          </button>
        </div>

        {/* Option 3: Continue Exam */}
        <div className="pt-2 border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            disabled={loadingAction !== null}
            className="px-5 py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs rounded-xl transition"
          >
            ← Resume Exam Now
          </button>
        </div>
      </div>
    </div>
  );
}