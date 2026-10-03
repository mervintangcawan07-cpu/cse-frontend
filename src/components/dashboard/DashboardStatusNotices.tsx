import Link from "next/link";

interface DashboardStatusNoticesProps {
  readonly paymentStatus: string | null;
  readonly isAdmin: boolean;
}

export default function DashboardStatusNotices({ paymentStatus, isAdmin }: DashboardStatusNoticesProps) {
  if (paymentStatus !== "success" && !isAdmin) return null;

  return (
    <div className="space-y-3 px-4 pt-3 sm:px-5 md:px-6 xl:px-0 xl:pt-0">
      {paymentStatus === "success" && (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500 p-3.5 text-xs font-black text-slate-950 shadow-sm animate-in fade-in duration-300 sm:p-4">
          Payment verified. Your PRO Access duration has been updated.
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-3.5 text-xs font-bold text-amber-700 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-amber-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">
              Admin
            </span>
            <span>Logged in with Administrator privileges.</span>
          </div>
          <Link
            href="/admin/pricing"
            className="shrink-0 rounded-xl bg-amber-500 px-3.5 py-2 text-center font-black text-slate-950 shadow-sm transition hover:bg-amber-400"
          >
            Manage Plan Pricing
          </Link>
        </div>
      )}
    </div>
  );
}
