import type { ReactNode } from "react";

interface MetricCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly supportingText: ReactNode;
  readonly icon: ReactNode;
  readonly iconClassName: string;
  readonly valueClassName?: string;
  readonly footer?: ReactNode;
  readonly className?: string;
}

export default function MetricCard({
  label,
  value,
  supportingText,
  icon,
  iconClassName,
  valueClassName = "text-slate-950 dark:text-white",
  footer,
  className = "",
}: MetricCardProps) {
  return (
    <div
      className={`flex min-h-[132px] flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:min-h-[150px] sm:p-5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-[11px]">
          {label}
        </span>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg ${iconClassName}`}>
          {icon}
        </span>
      </div>

      <div className="mt-3">
        <div className={`text-2xl font-black tracking-tight sm:text-3xl ${valueClassName}`}>{value}</div>
        <div className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-[11px]">
          {supportingText}
        </div>
      </div>

      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

