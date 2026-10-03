"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";

import WidgetErrorBoundary from "@/components/common/WidgetErrorBoundary";
import SectionHeader from "@/components/ui/SectionHeader";

import type { DetailedAnalytics } from "./dashboardTypes";

const ScoreAnalyticsChart = dynamic(
  () => import("@/components/dashboard/ScoreAnalyticsChart"),
  {
    ssr: false,
    loading: () => (
      <div
        className="
          flex
          h-full
          min-h-[14rem]
          w-full
          min-w-0
          items-center
          justify-center
          rounded-2xl
          border
          border-slate-100
          bg-slate-50
          animate-pulse

          dark:border-slate-800
          dark:bg-slate-800/40

          sm:min-h-[16rem]
        "
      >
        <span className="text-xs font-semibold text-slate-400">
          Loading chart metrics...
        </span>
      </div>
    ),
  }
);

interface DashboardAnalyticsProps {
  readonly analytics: DetailedAnalytics | null;
  readonly loading: boolean;
  readonly error: boolean;
  readonly onRetry: () => Promise<void> | void;
}

interface ScoreChartViewportProps {
  readonly scoreHistory: DetailedAnalytics["scoreHistory"];
}

/* =========================================================
   ICONS
   Avoid emoji / encoding issues such as:
   ðŸ“Š
   ðŸ”„
========================================================= */

function AnalyticsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 19V9m5 10V5m5 14v-7m5 7V8"
      />
    </svg>
  );
}

function RefreshIcon({
  className = "h-4 w-4",
}: Readonly<{
  className?: string;
}>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 7h-5V2m4.5 5A8 8 0 0 0 5 5m-1 12h5v5m-4.5-5A8 8 0 0 0 19 19"
      />
    </svg>
  );
}

/* =========================================================
   SAFE RESPONSIVE CHART CONTAINER

   Recharts ResponsiveContainer can warn when mounted inside
   display:none because its measured dimensions become 0 x 0.

   This component observes its real dimensions and only mounts
   ScoreAnalyticsChart after width and height are both > 0.
========================================================= */

function ScoreChartViewport({
  scoreHistory,
}: ScoreChartViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    let animationFrame: number | null = null;

    const measure = () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }

      animationFrame = requestAnimationFrame(() => {
        const { width, height } =
          element.getBoundingClientRect();

        setIsReady(
          width > 0 &&
          height > 0
        );
      });
    };

    measure();

    const resizeObserver =
      new ResizeObserver(measure);

    resizeObserver.observe(element);

    /*
     * ResizeObserver normally handles breakpoint transitions,
     * but this gives us another measurement when the viewport
     * itself changes.
     */
    window.addEventListener(
      "resize",
      measure
    );

    return () => {
      resizeObserver.disconnect();

      window.removeEventListener(
        "resize",
        measure
      );

      if (animationFrame !== null) {
        cancelAnimationFrame(
          animationFrame
        );
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="
        relative
        h-56
        min-h-[14rem]
        w-full
        min-w-0
        overflow-hidden
        pt-2

        sm:h-64
        sm:min-h-[16rem]
        sm:pt-4
      "
    >
      {isReady ? (
        <ScoreAnalyticsChart
          scoreHistory={scoreHistory}
        />
      ) : (
        <div
          aria-hidden="true"
          className="
            h-full
            min-h-0
            w-full
            min-w-0
          "
        />
      )}
    </div>
  );
}

/* =========================================================
   GENERIC ANALYTICS CARD
========================================================= */

function AnalyticsCard({
  children,
  className = "",
}: Readonly<{
  children: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={`
        min-w-0
        rounded-2xl
        border
        border-slate-200/80
        bg-white
        p-4
        shadow-sm

        dark:border-slate-800
        dark:bg-slate-900

        sm:rounded-3xl
        sm:p-6

        ${className}
      `}
    >
      {children}
    </div>
  );
}

/* =========================================================
   CONTENT
========================================================= */

function AnalyticsContent({
  analytics,
  loading,
  error,
  onRetry,
}: DashboardAnalyticsProps) {
  if (loading) {
    return (
      <div
        className="
          space-y-2
          rounded-2xl
          border
          border-slate-200/80
          bg-white
          p-6
          text-center
          shadow-sm

          dark:border-slate-800
          dark:bg-slate-900

          sm:rounded-3xl
          sm:p-8
        "
      >
        <div
          className="
            mx-auto
            h-8
            w-8
            animate-spin
            rounded-full
            border-[3px]
            border-blue-600
            border-t-transparent
          "
        />

        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Refreshing exam performance statistics...
        </p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div
        className="
          flex
          flex-col
          items-center
          justify-between
          gap-4
          rounded-2xl
          border
          border-slate-800
          bg-slate-900
          p-4
          text-white
          shadow-sm

          sm:flex-row
          sm:rounded-3xl
          sm:p-6
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="
              grid
              h-11
              w-11
              shrink-0
              place-items-center
              rounded-2xl
              border
              border-amber-500/30
              bg-amber-500/20
              text-amber-400
            "
          >
            <AnalyticsIcon />
          </span>

          <div className="min-w-0">
            <h3 className="text-sm font-black text-white">
              Exam Statistics Temporarily Unavailable
            </h3>

            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              Your mock exams, questions, and streak
              counters are operating normally.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onRetry()}
          disabled={loading}
          className="
            inline-flex
            w-full
            shrink-0
            items-center
            justify-center
            gap-2
            whitespace-nowrap
            rounded-xl
            bg-blue-600
            px-4
            py-2.5
            text-center
            text-xs
            font-extrabold
            text-white
            shadow-sm
            transition

            hover:bg-blue-500

            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-blue-400
            focus-visible:ring-offset-2
            focus-visible:ring-offset-slate-900

            disabled:cursor-not-allowed
            disabled:opacity-50

            sm:w-auto
          "
        >
          <RefreshIcon />
          <span>Retry Loading Stats</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="
        grid
        min-w-0
        grid-cols-1
        gap-3.5

        sm:gap-5

        lg:grid-cols-3
      "
    >
      {/* =====================================================
          SCORE PROGRESSION
      ====================================================== */}
      <AnalyticsCard className="space-y-4 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              className="
                text-base
                font-black
                text-slate-900

                dark:text-white

                sm:text-lg
              "
            >
              Score Progression
            </h2>

            <p
              className="
                text-[11px]
                leading-relaxed
                text-slate-500

                dark:text-slate-400

                sm:text-xs
              "
            >
              Historical performance across mock exam
              attempts
            </p>
          </div>

          <span
            className="
              shrink-0
              rounded-full
              border
              border-emerald-200
              bg-emerald-50
              px-2.5
              py-1
              text-[10px]
              font-extrabold
              text-emerald-700

              dark:border-emerald-500/30
              dark:bg-emerald-500/10
              dark:text-emerald-300

              sm:px-3
              sm:text-xs
            "
          >
            80% Benchmark
          </span>
        </div>

        <ScoreChartViewport
          scoreHistory={analytics.scoreHistory}
        />
      </AnalyticsCard>

      {/* =====================================================
          SUBJECT MASTERY
      ====================================================== */}
      <AnalyticsCard className="space-y-4">
        <div>
          <h2
            className="
              text-base
              font-black
              text-slate-900

              dark:text-white

              sm:text-lg
            "
          >
            Subject Mastery
          </h2>

          <p
            className="
              text-[11px]
              font-medium
              text-slate-500

              dark:text-slate-400

              sm:text-xs
            "
          >
            Accuracy rate by core subject
          </p>
        </div>

        <div
          className="
            space-y-3.5
            pt-1

            sm:space-y-4
            sm:pt-2
          "
        >
          {analytics.categoryBreakdown.map(
            (cat) => (
              <div
                key={cat.category}
                className="
                  min-w-0
                  space-y-1

                  sm:space-y-1.5
                "
              >
                <div
                  className="
                    flex
                    min-w-0
                    justify-between
                    gap-3
                    text-xs
                    font-bold
                    text-slate-700

                    dark:text-slate-300
                  "
                >
                  <span className="min-w-0 truncate">
                    {cat.category}
                  </span>

                  <span
                    className="
                      shrink-0
                      font-extrabold
                      text-slate-900

                      dark:text-white
                    "
                  >
                    {cat.score}%
                  </span>
                </div>

                <div
                  className="
                    h-2.5
                    w-full
                    min-w-0
                    overflow-hidden
                    rounded-full
                    bg-slate-100

                    dark:bg-slate-800
                  "
                >
                  <div
                    className={`
                      h-2.5
                      rounded-full
                      transition-[width]
                      duration-500
                      ${cat.color}
                    `}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          cat.score
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )
          )}
        </div>
      </AnalyticsCard>
    </div>
  );
}

/* =========================================================
   DASHBOARD ANALYTICS
========================================================= */

export default function DashboardAnalytics(
  props: DashboardAnalyticsProps
) {
  return (
    <section
      className="
        min-w-0
        space-y-3

        sm:space-y-4
      "
      aria-labelledby="analytics-heading"
    >
      <SectionHeader
        id="analytics-heading"
        title="Performance Insights"
      />

      <WidgetErrorBoundary
        fallbackTitle="Performance Charts Temporarily Unavailable"
        onRetry={props.onRetry}
      >
        <AnalyticsContent {...props} />
      </WidgetErrorBoundary>
    </section>
  );
}