export const dashboardStyles = {
  page: "w-full",
  content:
    "flex flex-col gap-4 px-4 pb-6 sm:gap-5 sm:px-5 md:px-6 lg:gap-6 lg:px-7 xl:px-7 xl:pb-8 2xl:px-9",
  card:
    "rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl",
  sectionTitle:
    "text-base font-black tracking-tight text-slate-950 dark:text-white sm:text-lg",
  mutedText: "text-xs font-medium text-slate-500 dark:text-slate-400",
  statusPill:
    "rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide sm:text-[10px]",
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
  blueIcon:
    "border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
  emeraldIcon:
    "border border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  amberIcon:
    "border border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
  purpleIcon:
    "border border-purple-100 bg-purple-50 text-purple-600 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-300",
} as const;
