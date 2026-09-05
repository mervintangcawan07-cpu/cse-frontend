import Link from "next/link";

export default function LessonPage() {
  return (
    <div className="w-full max-w-5xl mx-auto py-3 sm:py-6 md:py-10 px-2 sm:px-4 md:px-6 space-y-4 sm:space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="text-sm font-bold text-slate-500 space-x-2">
        <Link href="/reviewer" className="hover:text-blue-600 transition">Reviewer</Link>
        <span>/</span>
        <span className="text-slate-800">Numerical Ability</span>
      </div>

      {/* Lesson Header */}
      <div className="bg-white p-4 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h1 className="text-3xl font-extrabold text-slate-800">
          Fractions, Decimals, and Percentages
        </h1>
        <p className="text-slate-600 text-lg">
          Learn the fundamental conversions required for word problems.
        </p>
        
        {/* Badges */}
        <div className="flex gap-3 pt-2">
          <span className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-full">
            ⏱ Estimated Time: 15 mins
          </span>
          <span className="px-4 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
            ⭐ Premium Content
          </span>
        </div>
      </div>

      {/* Lesson Content */}
      <div className="bg-white p-4 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-8 sm:space-y-10">
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800">1. Converting Fractions to Decimals</h2>
          <p className="text-slate-600 leading-relaxed">
            To convert a fraction to a decimal, simply divide the numerator (top number) by the denominator (bottom number).
          </p>
          
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-slate-700 text-sm">
            <span className="font-bold text-slate-900 block mb-2 uppercase text-xs tracking-wider">Example:</span>
            3 / 4 = 0.75
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800">2. Study Tip for the CSE</h2>
          <p className="text-slate-600 leading-relaxed">
            Memorize common fractions (1/2, 1/4, 3/4, 1/5) as decimals. This saves crucial time during the timed examination!
          </p>
        </section>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-4">
        <Link 
          href="/reviewer" 
          className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
        >
          ← Previous Lesson
        </Link>
        <Link 
          href="/mock-exam/take" 
          className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-sm"
        >
          Take Practice Quiz →
        </Link>
      </div>
    </div>
  );
}
