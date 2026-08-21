"use client";

import { useEffect, useState } from "react";
import { fetchWithClientCache } from "@/lib/clientCache";

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
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch public info (bypassing stale null cache if necessary)
        const res = await fetch(`/api/csc/public-info?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.nextSchedule) {
            setSchedule(data.nextSchedule);
          }
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
          <button
            type="button"
            onClick={() => setShowAppointmentModal(true)}
            className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl transition text-center flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>📅</span>
            <span>CSC Appointment Helper ↗</span>
          </button>

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

      {/* 🏛️ REGIONAL CSC APPOINTMENT PORTAL CHOOSER MODAL */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                  Official Government Portals
                </span>
                <h3 className="text-xl font-black text-white mt-2">
                  Choose CSC Application Portal
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Different CSC Regional Offices designate different online systems for slot reservations. Select the portal applicable to your region:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAppointmentModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Option 1: OCSEAS */}
              <a
                href="https://ocseas.csc.gov.ph"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-slate-950 hover:bg-blue-950/40 border border-slate-800 hover:border-blue-500/50 rounded-2xl transition group flex flex-col sm:flex-row sm:items-center justify-between gap-3 block"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-white group-hover:text-blue-400 transition">
                      1. CSC OCSEAS Portal
                    </span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-md border border-blue-500/30">
                      National System
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Online Civil Service Examination Application System used by CSC Central & participating Regional Offices.
                  </p>
                </div>
                <span className="px-3.5 py-2 bg-blue-600 group-hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition text-center shrink-0">
                  Open OCSEAS ↗
                </span>
              </a>

              {/* Option 2: CSC Services */}
              <a
                href="https://services.csc.gov.ph"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-slate-950 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group flex flex-col sm:flex-row sm:items-center justify-between gap-3 block"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-white group-hover:text-indigo-400 transition">
                      2. CSC Online Services Portal
                    </span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md border border-indigo-500/30">
                      Regional Appointments
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Centralized CSC Online Services portal used by regional offices for slot reservation, filing, and exam services.
                  </p>
                </div>
                <span className="px-3.5 py-2 bg-indigo-600 group-hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition text-center shrink-0">
                  Open Services ↗
                </span>
              </a>

              {/* Option 3: CSC ORAS */}
              <a
                href="https://appointment.csc.gov.ph"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-slate-950 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/50 rounded-2xl transition group flex flex-col sm:flex-row sm:items-center justify-between gap-3 block"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-white group-hover:text-amber-400 transition">
                      3. CSC ORAS Portal
                    </span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md border border-amber-500/30">
                      Field Office Slots
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Online Registration & Appointment System for specific field office in-person appearance bookings.
                  </p>
                </div>
                <span className="px-3.5 py-2 bg-amber-500 group-hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition text-center shrink-0">
                  Open ORAS ↗
                </span>
              </a>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-medium">
              💡 <strong className="text-slate-300">Regional Tip:</strong> Please verify with your specific CSC Regional Office advisory (e.g. NCR, RO3, RO4, RO7, RO11) to confirm whether your testing center requires OCSEAS, Services, or ORAS.
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowAppointmentModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close Chooser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
