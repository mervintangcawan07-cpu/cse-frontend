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
      <div className="w-full py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading Appointment Hub...
      </div>
    );
  }

  return (
    <div className="w-full px-0 py-2 sm:px-3 sm:py-4 lg:px-6 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-none border-x-0 sm:rounded-2xl sm:border lg:rounded-3xl shadow-xl overflow-hidden">
        {/* HEADER - Seamlessly integrated */}
        <div className="bg-slate-900 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800">
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

        {/* UNIFIED CONTENT BODY */}
        <div className="p-3.5 sm:p-6 md:p-8 space-y-6">
          {message && (
            <div className="p-4 bg-slate-950 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl">
              {message}
            </div>
          )}

          {/* 🚀 DIRECT OFFICIAL GOVERNMENT CSC REDIRECT CARDS */}
          <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-950 border border-blue-500/30 p-5 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* OCSEAS Main Portal */}
              <div className="bg-slate-900/90 border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-blue-400">CSC OCSEAS</span>
                    <span className="text-[10px] font-bold text-slate-400">National System</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2">
                    Online Civil Service Exam Application System
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    National online application portal used by CSC Central &amp; designated Regional Offices.
                  </p>
                </div>

                <a
                  href="https://ocseas.csc.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition text-center shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open OCSEAS</span>
                  <span>↗</span>
                </a>
              </div>

              {/* CSC Services Portal */}
              <div className="bg-slate-900/90 border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-indigo-400">CSC Services</span>
                    <span className="text-[10px] font-bold text-slate-400">Regional Slots</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2">
                    CSC Online Services Portal
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Regional slot reservation, appointment booking, and exam application services.
                  </p>
                </div>

                <a
                  href="https://services.csc.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition text-center shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open Services</span>
                  <span>↗</span>
                </a>
              </div>

              {/* ORAS Main Portal */}
              <div className="bg-slate-900/90 border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-amber-400">CSC ORAS</span>
                    <span className="text-[10px] font-bold text-slate-400">Field Office Slots</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2">
                    Online Registration &amp; Appointment System
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Slot appointment scheduling for in-person application filing at CSC Field Offices.
                  </p>
                </div>

                <a
                  href="https://appointment.csc.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition text-center shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open ORAS</span>
                  <span>↗</span>
                </a>
              </div>

              {/* ERPO ONSERGS Portal */}
              <div className="bg-slate-900/90 border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-emerald-400">CSC ERPO</span>
                    <span className="text-[10px] font-bold text-slate-400">Room &amp; Results</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2">
                    ONSA &amp; OCSERGS Portal
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Online School Assignment (ONSA) and Certificate of Eligibility / Rating system.
                  </p>
                </div>

                <a
                  href="https://erpo.csc.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition text-center shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open ERPO</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* USER ACTIVE APPOINTMENTS */}
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <span>📋</span>
              <span>Your Booked Review & Sit-In Sessions</span>
            </h2>

            {appointments.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                You have no active appointment reservations.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appointments.map((app) => (
                  <div
                    key={app.id}
                    className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2 relative"
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
                className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value="APPLICATION_FILING">Filing Pre-Check</option>
                <option value="VERIFICATION">Document Verification</option>
                <option value="MOCK_EXAM_SITIN">Mock Exam Sit-In</option>
              </select>
            </div>

            {slots.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
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
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3"
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
      </div>
    </div>
  );
}
