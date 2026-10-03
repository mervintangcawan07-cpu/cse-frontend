export const navigationStyles = {
  root:
    "fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200/90 bg-white/95 shadow-[0_-10px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 xl:hidden",
  itemBase:
    "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-[10px]",
  itemActive: "text-blue-600 dark:text-blue-400",
  itemInactive:
    "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
  dot: "absolute bottom-1 h-1 w-1 rounded-full bg-blue-600 dark:bg-blue-400",
} as const;

