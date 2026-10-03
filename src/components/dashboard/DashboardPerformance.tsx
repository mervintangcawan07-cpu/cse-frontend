import MetricCard from "@/components/ui/MetricCard";
import SectionHeader from "@/components/ui/SectionHeader";
import { BookmarkIcon, ExamIcon } from "./DashboardIcons";
import { dashboardStyles } from "./dashboardStyles";
import type { DashboardAnalytics, DetailedAnalytics } from "./dashboardTypes";

interface DashboardPerformanceProps {
  readonly dashAnalytics: DashboardAnalytics | null;
  readonly analytics: DetailedAnalytics | null;
}

export default function DashboardPerformance({ dashAnalytics, analytics }: DashboardPerformanceProps) {
  const totalExamsTaken = analytics?.summary.totalExamsTaken ?? dashAnalytics?.totalExams ?? 0;
  const averageScore = analytics?.summary.averageScore ?? dashAnalytics?.averageScore ?? 0;

  return (
    <section className="md:hidden" aria-labelledby="mobile-performance-heading">
      <SectionHeader id="mobile-performance-heading" title="Performance Overview" className="mb-2.5" />
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Mock Exams"
          value={totalExamsTaken}
          supportingText={<>Avg: {averageScore}%</>}
          icon={<ExamIcon />}
          iconClassName={dashboardStyles.blueIcon}
        />
        <MetricCard
          label="Bookmarks"
          value={dashAnalytics?.totalBookmarks ?? 0}
          supportingText="Saved for review"
          icon={<BookmarkIcon />}
          iconClassName={dashboardStyles.purpleIcon}
          valueClassName="text-purple-600 dark:text-purple-400"
        />
      </div>
    </section>
  );
}
