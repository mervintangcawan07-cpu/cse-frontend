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
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center text-slate-400 text-xs font-bold animate-pulse">
        Fetching Official CSC Exam Timetable...
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center text-slate-400 text-xs">
        📢 No upcoming examination schedule announced. Visit{" "}
        <a href="https://csc.gov.ph" target="_blank" rel="noreferrer" className="text-blue-400 underline font-bold">
          csc.gov.ph
        </a>{" "}
        for updates.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 text-white p-6 md:p-8 rounded-3xl shadow-xl space-y-5 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Official CSC Timetable
          </span>
          <h3 className="text-lg font-extrabold text-white mt-1">{schedule.title}</h3>
        </div>

        <span
          className={`text-xs font-black px-3 py-1 rounded-xl uppercase shrink-0 ${
            schedule.status === "APPLICATIONS_OPEN"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          }`}
        >
          {schedule.status === "APPLICATIONS_OPEN" ? "🟢 Applications Open" : "⏱️ Scheduled"}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center pt-2">
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-2xl md:text-3xl font-black text-amber-400 block">{timeLeft.days}</span>
          <span className="text-[10px] font-bold uppercase text-slate-400">Days</span>
        </div>
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-2xl md:text-3xl font-black text-white block">{timeLeft.hours}</span>
          <span className="text-[10px] font-bold uppercase text-slate-400">Hours</span>
        </div>
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-2xl md:text-3xl font-black text-white block">{timeLeft.minutes}</span>
          <span className="text-[10px] font-bold uppercase text-slate-400">Mins</span>
        </div>
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-2xl md:text-3xl font-black text-blue-400 block">{timeLeft.seconds}</span>
          <span className="text-[10px] font-bold uppercase text-slate-400">Secs</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs pt-2 font-medium border-t border-slate-800/60">
        <div className="flex items-center gap-2 bg-slate-800/90 border border-amber-500/30 px-3.5 py-2 rounded-2xl shadow-inner">
          <span className="text-base">🗓️</span>
          <span className="text-slate-300 font-bold text-xs uppercase tracking-wider">Exam Date:</span>
          <strong className="text-amber-400 font-black text-sm md:text-base tracking-wide">
            {new Date(schedule.examDate).toLocaleDateString()}
          </strong>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <a
            href="https://ocseas.csc.gov.ph"
            target="_blank"
            rel="noreferrer"
            className="flex-1 md:flex-initial px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold text-xs rounded-xl transition text-center flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>📅</span>
            <span>CSC Exam Appointment Helper ↗</span>
          </a>

          <a
            href="https://csc.gov.ph"
            target="_blank"
            rel="noreferrer"
            className="flex-1 md:flex-initial px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl transition text-center flex items-center justify-center gap-1 shadow-sm"
          >
            <span>🏛️</span>
            <span>Civil Service Portal ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
