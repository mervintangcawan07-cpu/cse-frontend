import type { ReactNode } from "react";

interface SectionHeaderProps {
  readonly title: string;
  readonly id?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

export default function SectionHeader({ title, id, action, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <h2
        id={id}
        className="text-base font-black tracking-tight text-slate-950 dark:text-white sm:text-lg"
      >
        {title}
      </h2>
      {action}
    </div>
  );
}

