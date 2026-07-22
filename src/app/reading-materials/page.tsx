import Link from "next/link";

export default function ReadingMaterialsPage() {
  const categories = [
    { title: "English Grammar", topics: "Subject-Verb Agreement, Tenses, Modals", color: "bg-indigo-50 text-indigo-700" },
    { title: "Philippine Constitution", topics: "Preamble, Bill of Rights, Citizenship", color: "bg-blue-50 text-blue-700" },
    { title: "Mathematics Review", topics: "Algebra, Geometry, Word Problems", color: "bg-emerald-50 text-emerald-700" },
    { title: "Current Events", topics: "National Issues, Environmental Updates", color: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      
      {/* Header Section */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <h1 className="text-3xl font-extrabold text-slate-800">Reading Materials</h1>
        <p className="text-slate-500 text-sm mt-2">
          Comprehensive study guides to replace heavy PDF reviewers.
        </p>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((cat, index) => (
          <div key={index} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-5 hover:border-blue-300 transition">
            
            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${cat.color}`}>
              📚
            </div>
            
            {/* Text Content */}
            <div className="space-y-2 flex-grow">
              <h2 className="text-lg font-bold text-slate-800">{cat.title}</h2>
              <p className="text-slate-500 text-sm">{cat.topics}</p>
              
              <div className="pt-2">
                <Link href="#" className="inline-block text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline">
                  Browse Lessons →
                </Link>
              </div>
            </div>

          </div>
        ))}
      </div>
      
    </div>
  );
}