export default function DashboardStudyFocus({ recommendation }: Readonly<{ recommendation?: string | null }>) {
  if (!recommendation) return null;

  return (
    <section aria-labelledby="study-focus-heading">
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/10 sm:rounded-3xl sm:p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-lg shadow-sm dark:bg-slate-900">
          ðŸ’¡
        </span>
        <div>
          <h3 id="study-focus-heading" className="text-[10px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-300 sm:text-xs">
            Personalized Study Focus
          </h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-300">
            {recommendation}
          </p>
        </div>
      </div>
    </section>
  );
}

