// Relative Path: src/components/social/StudyEventsSection.tsx
"use client";

import { useEffect, useState } from "react";

export default function StudyEventsSection() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "mine">("upcoming");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("Full Mock Drill");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [creating, setCreating] = useState(false);

  const topics = [
    "Full Mock Drill",
    "Numerical Reasoning Masterclass",
    "Verbal Ability Sprint",
    "Analytical Reasoning Practice",
    "General Information Review",
    "Philippine Constitution Q&A",
  ];

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/social/events?filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const updateRsvp = async (eventId: string, status: "ATTENDING" | "MAYBE" | "DECLINED") => {
    try {
      const res = await fetch("/api/social/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, status }),
      });
      if (res.ok) {
        await fetchEvents();
      }
    } catch (err) {
      console.error("Failed to update RSVP:", err);
    }
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt || creating) return;

    setCreating(true);
    try {
      const res = await fetch("/api/social/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          topic,
          scheduledAt,
          durationMin,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setTitle("");
        setDescription("");
        setScheduledAt("");
        await fetchEvents();
      }
    } catch (err) {
      console.error("Failed to create event:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white">Scheduled Review Events</h3>
          <p className="text-xs text-slate-400">RSVP for upcoming group mock drills and live Civil Service review sessions.</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
        >
          + Schedule Event
        </button>
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setFilter("upcoming")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "upcoming" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Upcoming Events
        </button>
        <button
          onClick={() => setFilter("mine")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "mine" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          My RSVPs & Hosted
        </button>
      </div>

      {/* EVENTS LIST */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 font-bold animate-pulse">
          Loading scheduled events...
        </div>
      ) : events.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <span className="text-4xl block">📅</span>
          <h4 className="text-sm font-bold text-white">No Review Events Scheduled</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Schedule a review event or mock exam drill to study synchronously with fellow examinees.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {events.map((event) => {
            const dateObj = new Date(event.scheduledAt);
            const isAttending = event.myRsvp === "ATTENDING";

            return (
              <div key={event.id} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 hover:border-slate-700 transition flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                      {event.topic}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      👥 {event.attendingCount} Attending
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">{event.title}</h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {event.description || "Synchronous review event with timed practice items."}
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Scheduled Time</span>
                      <span className="font-bold">{dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} @ {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      ⏱️ {event.durationMin}m
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Host: {event.host?.name || "Examinee"}
                  </span>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => updateRsvp(event.id, "ATTENDING")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                        isAttending
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                      }`}
                    >
                      {isAttending ? "✓ Attending" : "Attending"}
                    </button>
                    <button
                      onClick={() => updateRsvp(event.id, "DECLINED")}
                      className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Schedule Study Event</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
                &times;
              </button>
            </div>

            <form onSubmit={createEvent} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Event Title *</label>
                <input
                  type="text"
                  placeholder="e.g., Saturday Morning Mock Exam Drill"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Focus Topic</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {topics.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min="15"
                    max="300"
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Description (Optional)</label>
                <textarea
                  placeholder="What materials or practice items will be covered?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 h-20"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !title.trim() || !scheduledAt}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {creating ? "Scheduling..." : "Schedule Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}