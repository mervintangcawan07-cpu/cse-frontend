"use client";

import CSCCountdownCard from "./csc/CSCCountdownCard";
import useCSCCountdown from "./csc/useCSCCountdown";

export default function CSCCountdownWidget() {
  const { schedule, displayMetrics, loading } = useCSCCountdown();

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 text-center text-xs font-bold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:rounded-3xl">
        Fetching Official CSC Exam Timetable...
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-center text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:rounded-3xl">
        No upcoming examination schedule announced. Visit{" "}
        <a
          href="https://erpo.csc.gov.ph"
          target="_blank"
          rel="noreferrer"
          className="font-bold text-blue-600 underline dark:text-blue-400"
        >
          erpo.csc.gov.ph
        </a>{" "}
        for updates.
      </div>
    );
  }

  return (
    <CSCCountdownCard
      schedule={schedule}
      displayMetrics={displayMetrics}
    />
  );
}
