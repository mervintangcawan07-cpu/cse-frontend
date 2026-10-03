import type { DisplayMetrics, TimeLeft } from "./cscTypes";

export function getPluralLabel(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural;
}

export function calculateTimeLeft(examDate: string): TimeLeft {
  const target = new Date(examDate).getTime();
  const difference = target - Date.now();

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

export function computeDisplayMetrics(timeLeft: TimeLeft): DisplayMetrics {
  if (timeLeft.days >= 30) {
    const months = Math.floor(timeLeft.days / 30);
    const remainingDays = timeLeft.days % 30;

    return {
      unit1: { value: months, label: getPluralLabel(months, "Month", "Months") },
      unit2: { value: remainingDays, label: getPluralLabel(remainingDays, "Day", "Days") },
      unit3: { value: timeLeft.hours, label: getPluralLabel(timeLeft.hours, "Hour", "Hours") },
    };
  }

  return {
    unit1: { value: timeLeft.days, label: getPluralLabel(timeLeft.days, "Day", "Days") },
    unit2: { value: timeLeft.hours, label: getPluralLabel(timeLeft.hours, "Hour", "Hours") },
    unit3: { value: timeLeft.minutes, label: getPluralLabel(timeLeft.minutes, "Minute", "Minutes") },
  };
}

export function formatExamDate(examDate: string): string {
  return new Date(examDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

