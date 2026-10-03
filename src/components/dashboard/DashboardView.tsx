import ResumeExamBanner from "@/components/dashboard/ResumeExamBanner";
import CSCCountdownWidget from "@/components/CSCCountdownWidget";
import CSCDailyQuestionWidget from "@/components/cse/CSCDailyQuestionWidget";
import WidgetErrorBoundary from "@/components/common/WidgetErrorBoundary";

import DashboardStatusNotices from "./DashboardStatusNotices";
import DashboardHero from "./DashboardHero";
import DashboardProgress from "./DashboardProgress";
import DashboardPerformance from "./DashboardPerformance";
import DashboardAnalytics from "./DashboardAnalytics";

import { dashboardStyles } from "./dashboardStyles";
import type { DashboardViewProps } from "./dashboardTypes";

export default function DashboardView(
  props: Readonly<DashboardViewProps>
) {
  return (
    <div className={dashboardStyles.page}>
      {/* =========================================================
          FULL-BLEED HERO
          Keeps the top of the dashboard visually connected
          to the desktop sidebar.
      ========================================================== */}
      <DashboardHero user={props.user} />

      {/* =========================================================
          DASHBOARD CONTENT
      ========================================================== */}
      <div className={dashboardStyles.content}>
        {/* =======================================================
            CSC COUNTDOWN
            Slightly overlaps the mountain hero.

            Keep the overlap moderate:
            - mobile: subtle
            - tablet: stronger
            - desktop: enough to visually connect both sections
        ======================================================== */}
        <div
          className="
            relative
            z-20

            -mt-8

            sm:-mt-9

            md:-mt-10

            lg:-mt-12

            xl:-mt-14

            2xl:-mt-16
          "
        >
          <WidgetErrorBoundary fallbackTitle="CSC Examination Timetable Unavailable">
            <CSCCountdownWidget />
          </WidgetErrorBoundary>
        </div>

        {/* =======================================================
            SYSTEM / PAYMENT / ADMIN NOTICES

            These are intentionally below the hero/countdown so
            they do not break the visual app header.
        ======================================================== */}
        <DashboardStatusNotices
          paymentStatus={props.paymentStatus}
          isAdmin={props.isAdmin}
        />

        {/* =======================================================
            RESUME ACTIVE EXAM
            Component already controls whether it has content.
        ======================================================== */}
        <ResumeExamBanner />

        {/* =======================================================
            USER PROGRESS
            Mobile:
            2-column layout

            Tablet/Desktop:
            wider metric layout
        ======================================================== */}
        <section aria-label="Your progress">
          <DashboardProgress
            dashAnalytics={props.dashAnalytics}
            analytics={props.analytics}
          />
        </section>

        {/* =======================================================
            DAILY PRACTICE
        ======================================================== */}
        <section aria-label="Daily Civil Service practice">
          <WidgetErrorBoundary fallbackTitle="Daily Practice Challenge Unavailable">
            <CSCDailyQuestionWidget />
          </WidgetErrorBoundary>
        </section>

        {/* =======================================================
            COMPACT PERFORMANCE OVERVIEW
            Particularly useful on mobile.
        ======================================================== */}
        <section aria-label="Performance overview">
          <DashboardPerformance
            dashAnalytics={props.dashAnalytics}
            analytics={props.analytics}
          />
        </section>

        {/* =======================================================
            DETAILED ANALYTICS
            Hidden on small phones to avoid excessive scrolling.

            Tablet/Desktop:
            full analytics becomes available.
        ======================================================== */}
        <section
          aria-label="Performance insights"
          className="
            hidden
            md:block

            md:pt-1
            lg:pt-2
            xl:pt-3
          "
        >
          <DashboardAnalytics
            analytics={props.analytics}
            loading={props.analyticsLoading}
            error={props.analyticsError}
            onRetry={props.onRetryAnalytics}
          />
        </section>

        {/* Extra breathing room above fixed mobile navigation */}
        <div
          aria-hidden="true"
          className="
            h-2
            md:h-3
            xl:h-4
          "
        />
      </div>
    </div>
  );
}