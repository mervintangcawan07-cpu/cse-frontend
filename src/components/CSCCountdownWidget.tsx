"use client";

import { useEffect, useState } from "react";

interface Schedule {
  title: string;
  examDate: string;
  appOpeningDate?: string;
  appClosingDate?: string;
  status: string;
}

export default function CSCCountdownWidget() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/csc/public-info");
        const data = await res.json();
        if (res.ok && data.nextSchedule) {
          setSchedule(data.nextSchedule);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!schedule?.examDate) return;

    const timer = setInterval(() => {
      const target = new Date(schedule.examDate).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [schedule]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 p-6 rounded-3xl text-center text-slate-500 text-xs font-bold animate-pulse shadow-sm">
        Fetching Official CSC Exam Timetable...
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="bg-white border border-slate-200/80 p-6 rounded-3xl text-center text-slate-600 text-xs shadow-sm">
        📢 No upcoming examination schedule announced. Visit{" "}
        <a href="https://erpo.csc.gov.ph" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">
          erpo.csc.gov.ph
        </a>{" "}
        for updates.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 text-slate-900 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-md space-y-4 sm:space-y-5 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200/80">
            Official CSC Timetable
          </span>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1.5 leading-snug">{schedule.title}</h3>
        </div>

        <span
          className={`text-xs font-black px-3 py-1.5 rounded-xl uppercase self-start sm:self-center shrink-0 ${
            schedule.status === "APPLICATIONS_OPEN"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {schedule.status === "APPLICATIONS_OPEN" ? "🟢 Applications Open" : "⏱️ Scheduled"}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center pt-1">
        <div className="bg-gradient-to-b from-blue-50/80 to-indigo-50/50 p-2 sm:p-3.5 rounded-2xl border border-blue-100 shadow-sm">
          <span className="text-xl sm:text-3xl font-black text-amber-500 block leading-tight">{timeLeft.days}</span>
          <span className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 tracking-wider">Days</span>
        </div>
        <div className="bg-gradient-to-b from-blue-50/80 to-indigo-50/50 p-2 sm:p-3.5 rounded-2xl border border-blue-100 shadow-sm">
          <span className="text-xl sm:text-3xl font-black text-slate-900 block leading-tight">{timeLeft.hours}</span>
          <span className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 tracking-wider">Hours</span>
        </div>
        <div className="bg-gradient-to-b from-blue-50/80 to-indigo-50/50 p-2 sm:p-3.5 rounded-2xl border border-blue-100 shadow-sm">
          <span className="text-xl sm:text-3xl font-black text-slate-900 block leading-tight">{timeLeft.minutes}</span>
          <span className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 tracking-wider">Mins</span>
        </div>
        <div className="bg-gradient-to-b from-blue-50/80 to-indigo-50/50 p-2 sm:p-3.5 rounded-2xl border border-blue-100 shadow-sm">
          <span className="text-xl sm:text-3xl font-black text-blue-600 block leading-tight">{timeLeft.seconds}</span>
          <span className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 tracking-wider">Secs</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs pt-2 font-medium border-t border-slate-100">
        <div className="flex items-center justify-between sm:justify-start gap-2 bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">🗓️</span>
            <span className="text-amber-900 font-bold text-xs uppercase tracking-wider">Exam Date:</span>
          </div>
          <strong className="text-amber-700 font-black text-sm sm:text-base tracking-wide">
            {new Date(schedule.examDate).toLocaleDateString()}
          </strong>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
          <a
            href="https://ocseas.csc.gov.ph"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl transition text-center flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>📅</span>
            <span>CSC Appointment Helper ↗</span>
          </a>

          <a
            href="https://erpo.csc.gov.ph"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl transition text-center flex items-center justify-center gap-1 shadow-sm"
          >
            <span>🏛️</span>
            <span>OCSERGS & ONSA ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
