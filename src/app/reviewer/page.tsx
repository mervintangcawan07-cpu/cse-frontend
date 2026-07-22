import Link from "next/link";

export default function ReviewerPage() {
  const subjects = [
    { title: "Verbal Ability", category: "Professional & Sub-Pro", count: "24 Lessons", color: "bg-blue-50 border-blue-200 text-blue-700" },
    { title: "Numerical Ability", category: "Professional & Sub-Pro", count: "30 Lessons", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { title: "Analytical Ability", category: "Professional Only", count: "18 Lessons", color: "bg-purple-50 border-purple-200 text-purple-700" },
    { title: "General Information", category: "Professional & Sub-Pro", count: "15 Lessons", color: "bg-amber-50 border-amber-200 text-amber-700" },
    { title: "Clerical Operations", category: "Sub-Pro Only", count: "12 Lessons", color: "bg-rose-50 border-rose-200 text-rose-700" },
  ];

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <h1 className="text-3xl font-extrabold text-slate-800">Reviewer Module</h1>
        <p className="text-slate-500 text-sm mt-2">
          Select a subject to start reviewing its lessons and practice quizzes.
        </p>
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((subject, index) => (
          <Link 
            href="/reviewer/lesson" 
            key={index}
            className={`p-6 rounded-3xl border shadow-sm hover:shadow-md transition flex flex-col justify-between min-h-[160px] ${subject.color}`}
          >
            <div>
              <span className="text-xs font-black uppercase tracking-wider opacity-70 mb-2 block">
                {subject.category}
              </span>
              <h2 className="text-xl font-extrabold">{subject.title}</h2>
            </div>
            
            <div className="flex justify-between items-center text-sm font-bold pt-4 opacity-90">
              <span>{subject.count}</span>
              <span className="hover:translate-x-1 transition-transform">Start &rarr;</span>
            </div>
          </Link>
        ))}
      </div>
      
    </div>
  );
}