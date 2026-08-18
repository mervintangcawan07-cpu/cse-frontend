"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Slot {
  id: string;
  locationName: string;
  region: string;
  date: string;
  timeWindow: string;
  maxSlots: number;
  bookedSlots: number;
}

interface Appointment {
  id: string;
  referenceNo: string;
  purpose: string;
  status: string;
  createdAt: string;
  slot: Slot;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("APPLICATION_FILING");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await fetch("/api/csc/appointments");
      const data = await res.json();
      if (res.ok) {
        setAppointments(data.userAppointments || []);
        setSlots(data.availableSlots || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = async (slotId: string) => {
    setBookingSlotId(slotId);
    setMessage("");
    try {
      const res = await fetch("/api/csc/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, purpose }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage("🎉 Appointment slot successfully booked!");
        fetchAppointments();
      } else {
        setMessage(`❌ Booking failed: ${data.error || "Slot unavailable"}`);
      }
    } catch (err) {
      setMessage("❌ Connection error while booking.");
    } finally {
      setBookingSlotId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading Appointment Hub...
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-2 py-3.5 sm:px-4 sm:py-6 md:px-6 space-y-4 sm:space-y-8 text-slate-100">
      {/* HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            Official Filing & Slot Reservation Hub
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-white mt-2">
            CSC Exam Appointment Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Book your official CSE filing slot directly on government portals or reserve internal sit-in review sessions.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* 🚀 DIRECT OFFICIAL GOVERNMENT CSC REDIRECT CARDS */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/30 p-6 rounded-3xl space-y-4 shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
              Government External Portal
            </span>
            <h2 className="text-lg font-black text-white mt-1">
              Official Civil Service Commission Appointment Systems
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Secure an official filing slot for the Civil Service Examination Pen and Paper Test (CSE-PPT).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* ORAS Main Portal */}
          <div className="bg-slate-900/90 border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-amber-400">CSC ORAS</span>
                <span className="text-[10px] font-bold text-slate-400">Official Slot Booking</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-2">
                Online Registration & Appointment System (ORAS)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Official slot appointment scheduling system for CSE application filing at CSC Field Offices.
              </p>
            </div>

            <a
              href="https://oras.csc.gov.ph"
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-blue-600/30"
            >
              Go to Official CSC ORAS Portal ↗
            </a>
          </div>

          {/* Regional eDORS & Services */}
          <div className="bg-slate-900/90 border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-emerald-400">CSC Main Portal</span>
                <span className="text-[10px] font-bold text-slate-400">Online Services</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-2">
                CSC Regional Portals & Online Filing Services
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Access regional office portals, regional eDORS scheduling, and exam announcement advisories.
              </p>
            </div>

            <a
              href="https://www.csc.gov.ph/online-services"
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-emerald-600/30"
            >
              Open CSC Online Services Portal ↗
            </a>
          </div>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-bold text-white">
          {message}
        </div>
      )}

      {/* USER'S CONFIRMED INTERNAL RESERVATIONS */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
          <span>📅</span>
          <span>Your Confirmed Reservations ({appointments.length})</span>
        </h2>

        {appointments.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
            You currently have no active internal reservation records.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {appointments.map((app) => (
              <div
                key={app.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 relative overflow-hidden"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {app.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Ref: {app.referenceNo.slice(-8).toUpperCase()}
                  </span>
                </div>

                <h3 className="text-sm font-black text-white mt-1">
                  {app.slot.locationName}
                </h3>
                <p className="text-xs text-amber-400 font-bold">
                  🗓️ {new Date(app.slot.date).toLocaleDateString()} ({app.slot.timeWindow})
                </p>
                <p className="text-[11px] text-slate-400">
                  Purpose: <strong className="text-slate-200">{app.purpose.replace("_", " ")}</strong>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INTERNAL PRACTICE & REVIEW SLOTS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <span>⚡</span>
            <span>Reviewer Platform Sit-in & Document Pre-Check Slots</span>
          </h2>

          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="APPLICATION_FILING">Filing Pre-Check</option>
            <option value="VERIFICATION">Document Verification</option>
            <option value="MOCK_EXAM_SITIN">Mock Exam Sit-In</option>
          </select>
        </div>

        {slots.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            No active internal review slots published. Use the official government links above to secure CSC filing slots.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slots.map((slot) => {
              const remaining = slot.maxSlots - slot.bookedSlots;
              const isFull = remaining <= 0;

              return (
                <div
                  key={slot.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-md">
                        {slot.region}
                      </span>
                      <span className={`text-[10px] font-bold ${isFull ? "text-red-400" : "text-emerald-400"}`}>
                        {isFull ? "FULLY BOOKED" : `${remaining} Slots Left`}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-white mt-2">{slot.locationName}</h3>
                    <p className="text-xs text-amber-400 font-bold mt-1">
                      🗓️ {new Date(slot.date).toLocaleDateString()} | {slot.timeWindow}
                    </p>
                  </div>

                  <button
                    onClick={() => handleBookSlot(slot.id)}
                    disabled={isFull || bookingSlotId === slot.id}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    {bookingSlotId === slot.id ? "Reserving Slot..." : isFull ? "Full" : "Reserve Internal Slot 🎟️"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}