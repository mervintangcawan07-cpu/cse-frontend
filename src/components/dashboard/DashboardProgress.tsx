import Link from "next/link";
import MetricCard from "@/components/ui/MetricCard";
import SectionHeader from "@/components/ui/SectionHeader";
import { BookmarkIcon, ExamIcon, FlameIcon, TargetIcon } from "./DashboardIcons";
import { dashboardStyles } from "./dashboardStyles";
import type { DashboardAnalytics, DetailedAnalytics } from "./dashboardTypes";

interface DashboardProgressProps {
  readonly dashAnalytics: DashboardAnalytics | null;
  readonly analytics: DetailedAnalytics | null;
}

export default function DashboardProgress({ dashAnalytics, analytics }: DashboardProgressProps) {
  const totalExamsTaken = analytics?.summary.totalExamsTaken ?? dashAnalytics?.totalExams ?? 0;
  const averageScore = analytics?.summary.averageScore ?? dashAnalytics?.averageScore ?? 0;

  return (
    <section aria-labelledby="progress-heading">
      <SectionHeader id="progress-heading" title="Your Progress" className="mb-2.5 sm:mb-3" />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4">
        <MetricCard
          label="Pass Readiness"
          value={`${dashAnalytics?.passReadinessScore ?? 0}%`}
          supportingText="Target: 80% cutoff"
          icon={<TargetIcon />}
          iconClassName={dashboardStyles.emeraldIcon}
          valueClassName="text-emerald-600 dark:text-emerald-400"
          footer={
            <Link href="/readiness-card" className="text-[10px] font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400">
              View details
            </Link>
          }
        />

        <MetricCard
          label="Study Streak"
          value={`${dashAnalytics?.currentStreak ?? 0} Days`}
          supportingText={<>Best: {dashAnalytics?.longestStreak ?? 0} Days</>}
          icon={<FlameIcon />}
          iconClassName={dashboardStyles.amberIcon}
          valueClassName="text-amber-500"
        />

        <MetricCard
          label="Mock Exams"
          value={totalExamsTaken}
          supportingText={<>Avg: {averageScore}%</>}
          icon={<ExamIcon />}
          iconClassName={dashboardStyles.blueIcon}
          className="hidden md:flex"
        />

        <MetricCard
          label="Bookmarks"
          value={dashAnalytics?.totalBookmarks ?? 0}
          supportingText="Saved for review"
          icon={<BookmarkIcon />}
          iconClassName={dashboardStyles.purpleIcon}
          valueClassName="text-purple-600 dark:text-purple-400"
          className="hidden md:flex"
        />
      </div>
    </section>
  );
}
