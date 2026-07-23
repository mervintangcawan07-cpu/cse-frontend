"use client";

import Link from "next/link";

export default function ReviewCenter() {
  const modes = [
    {
      title: "Practice Mock Exam",
      desc: "Full-length CSE practice test covering Verbal, Numerical, and Analytical reasoning.",
      icon: "📝",
      href: "/exam",
      badge: "Full Test",
      color: "border-blue-200 hover:border-blue-400 bg-blue-50/30",
      btnBg: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    {
      title: "Study Notes & Lessons",
      desc: "Read cheat sheets, grammar rules, and formulas published by instructors.",
      icon: "📚",
      href: "/modules",
      badge: "Reviewer Notes",
      color: "border-indigo-200 hover:border-indigo-400 bg-indigo-50/30",
      btnBg: "bg-indigo-600 hover:bg-indigo-700 text-white",
    },
    {
      title: "Timed Category Drill",
      desc: "Focus on speed and accuracy under real exam time pressure.",
      icon: "⏱️",
      href: "/exam?mode=timed",
      badge: "Speed Test",
      color: "border-emerald-200 hover:border-emerald-400 bg-emerald-50/30",
      btnBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Review Center</h2>
          <p className="text-xs text-slate-500">Choose your study mode and start practicing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((m, idx) => (
          <div
            key={idx}
            className={`p-6 rounded-3xl border ${m.color} transition shadow-sm hover:shadow-md flex flex-col justify-between space-y-4`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{m.icon}</span>
                <span className="text-[10px] font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-700">
                  {m.badge}
                </span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg">{m.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{m.desc}</p>
            </div>

            <Link
              href={m.href}
              className={`w-full py-3 rounded-xl font-bold text-xs text-center transition shadow-sm inline-block ${m.btnBg}`}
            >
              Start Module &rarr;
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}