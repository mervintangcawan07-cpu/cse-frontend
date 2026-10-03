import { CalendarIcon } from "./CSCIcons";
import { formatExamDate } from "./cscUtils";
import type { DisplayMetrics, Schedule } from "./cscTypes";

interface CSCCountdownCardProps {
  readonly schedule: Schedule;
  readonly displayMetrics: DisplayMetrics;
}

export default function CSCCountdownCard({
  schedule,
  displayMetrics,
}: CSCCountdownCardProps) {
  const statusIsOpen = schedule.status === "APPLICATIONS_OPEN";
  const countdownMetrics = [
    displayMetrics.unit1,
    displayMetrics.unit2,
    displayMetrics.unit3,
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5 md:px-6 lg:px-7 xl:px-8 xl:pt-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300 sm:h-10 sm:w-10">
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>

          <div className="min-w-0">
            <h2 className="truncate text-xs font-black text-slate-950 dark:text-white sm:text-sm md:text-base">
              {schedule.title}
            </h2>

            <p className="mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 sm:text-[11px] md:text-xs">
              Exam date: {formatExamDate(schedule.examDate)}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide sm:text-[10px] ${
            statusIsOpen
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
          }`}
        >
          {statusIsOpen ? "Applications Open" : "Official Date"}
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-100 px-2 py-3 text-center dark:divide-slate-800 dark:border-slate-800 sm:px-4 sm:py-4 md:py-5 xl:px-6 xl:py-6">
        {countdownMetrics.map((metric, index) => (
          <div key={`${metric.label}-${index}`} className="px-2 sm:px-4">
            <span
              className={`block text-xl font-black leading-none tabular-nums sm:text-2xl md:text-3xl xl:text-4xl ${
                index === 0
                  ? "text-amber-500"
                  : "text-slate-950 dark:text-white"
              }`}
            >
              {metric.value}
            </span>

            <span className="mt-1 block text-[8px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-[9px] md:text-[10px] xl:mt-1.5">
              {metric.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
