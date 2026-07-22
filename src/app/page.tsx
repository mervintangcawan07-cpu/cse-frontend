import Link from "next/link";

export default function LandingPage() {
  const features = [
    { title: "Smart Mock Exams", description: "Simulate the real Civil Service Exam with timed, adaptive tests.", icon: "⏱️" },
    { title: "Active Recall Flashcards", description: "Master vocabulary, constitution articles, and formulas faster.", icon: "🎴" },
    { title: "In-Depth Rationalizations", description: "Understand exactly why an answer is correct with detailed explanations.", icon: "🧠" },
    { title: "Performance Analytics", description: "Track your progress and pinpoint your weakest subjects instantly.", icon: "📊" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Navigation Bar */}
      <nav className="w-full bg-white border-b border-slate-200 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-10">
        <div className="text-2xl font-extrabold text-blue-600 tracking-tight">
          CSE<span className="text-slate-800">Mastery</span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/pricing" className="hidden md:block px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 transition">
            Pricing
          </Link>
          <Link href="/login" className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 transition">
            Log In
          </Link>
          <Link href="/register" className="px-5 py-2.5 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-sm">
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="flex flex-col items-center justify-center text-center px-4 py-24 md:py-32 max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-bold tracking-wide uppercase mb-6">
            Philippines' #1 CSE Reviewer
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-tight tracking-tight">
            Pass the Civil Service Exam on your <span className="text-blue-600">first try.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mt-6 max-w-2xl leading-relaxed">
            Stop guessing and start passing. Join thousands of Filipinos who passed the exam using our smart mock exams, flashcards, and detailed rationalizations.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-10 w-full sm:w-auto">
            <Link href="/register" className="px-8 py-4 font-bold text-lg text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/30 text-center">
              Start Reviewing Now
            </Link>
            <Link href="/pricing" className="px-8 py-4 font-bold text-lg text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition shadow-sm text-center">
              View Premium Plans
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section className="bg-white py-20 px-4 border-t border-slate-200">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">Everything you need to succeed</h2>
              <p className="text-slate-500 mt-4 text-lg">Designed specifically for the Philippine Civil Service Professional and Sub-Professional levels.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, i) => (
                <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:shadow-md transition">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-2xl mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 text-center">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="text-xl font-extrabold text-white tracking-tight mb-4 md:mb-0">
            CSE<span className="text-blue-500">Mastery</span>
          </div>
          <p className="text-sm">© 2026 CSE Mastery Philippines. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}