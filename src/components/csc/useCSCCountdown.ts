"use client";

import { useEffect, useMemo, useState } from "react";
import type { Schedule, TimeLeft } from "./cscTypes";
import { calculateTimeLeft, computeDisplayMetrics } from "./cscUtils";

export default function useCSCCountdown() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        const response = await fetch(`/api/csc/public-info?t=${Date.now()}`, {
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.nextSchedule) setSchedule(data.nextSchedule);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load CSC timetable:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!schedule?.examDate) return;

    const updateTimer = () => setTimeLeft(calculateTimeLeft(schedule.examDate));
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [schedule?.examDate]);

  const displayMetrics = useMemo(() => computeDisplayMetrics(timeLeft), [timeLeft]);

  return { schedule, timeLeft, displayMetrics, loading };
}

