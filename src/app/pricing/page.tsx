import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        
        <div className="text-center mb-16">
          <Link href="/dashboard" className="text-blue-600 font-semibold hover:underline mb-6 inline-block">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-4xl font-extrabold text-slate-900">Upgrade to Premium</h1>
          <p className="text-lg text-slate-600 mt-4">Unlock all features and maximize your chances of passing the Civil Service Exam.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* Free Plan */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col">
            <h2 className="text-2xl font-bold text-slate-800">Basic Free</h2>
            <p className="text-slate-500 mt-2">Perfect for getting a feel of the platform.</p>
            <div className="my-6">
              <span className="text-4xl font-extrabold text-slate-900">₱0</span>
              <span className="text-slate-500 font-medium"> / forever</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-slate-700">
                <span className="text-emerald-500 font-bold">✓</span> Limited Reading Materials
              </li>
              <li className="flex items-center gap-3 text-slate-700">
                <span className="text-emerald-500 font-bold">✓</span> 1 Diagnostic Mock Exam
              </li>
              <li className="flex items-center gap-3 text-slate-400">
                <span className="text-slate-300 font-bold">✕</span> No Premium Flashcards
              </li>
              <li className="flex items-center gap-3 text-slate-400">
                <span className="text-slate-300 font-bold">✕</span> No Detailed Rationalizations
              </li>
            </ul>
            <button className="w-full py-4 rounded-xl font-bold bg-slate-100 text-slate-500 cursor-not-allowed">
              Current Plan
            </button>
          </div>

          {/* Premium Plan */}
          <div className="bg-slate-900 rounded-3xl p-8 border border-blue-600 shadow-xl flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-bl-lg uppercase tracking-wider">
              Recommended
            </div>
            <h2 className="text-2xl font-bold text-white">Premium CSE</h2>
            <p className="text-slate-400 mt-2">Everything you need to pass in one place.</p>
            <div className="my-6">
              <span className="text-4xl font-extrabold text-white">₱999</span>
              <span className="text-slate-400 font-medium"> / one-time payment</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-slate-200">
                <span className="text-blue-400 font-bold">✓</span> Unlimited Mock Exams
              </li>
              <li className="flex items-center gap-3 text-slate-200">
                <span className="text-blue-400 font-bold">✓</span> Full Library of Reading Materials
              </li>
              <li className="flex items-center gap-3 text-slate-200">
                <span className="text-blue-400 font-bold">✓</span> Access to All Flashcard Decks
              </li>
              <li className="flex items-center gap-3 text-slate-200">
                <span className="text-blue-400 font-bold">✓</span> In-depth rationalizations for all questions
              </li>
            </ul>
            <Link href="/checkout" className="block text-center w-full py-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-900/50">
              Upgrade Now
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}