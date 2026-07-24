import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="inline-flex p-6 bg-slate-100 text-slate-800 rounded-3xl border border-slate-200 shadow-inner text-4xl font-black">
        404
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-extrabold text-slate-900">Page Not Found</h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          The requested reviewer module or route does not exist or may have been relocated.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-sm"
      >
        Return to Dashboard &rarr;
      </Link>
    </div>
  );
}