import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-8 border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">Welcome Back</h1>
          <p className="text-slate-500 mt-2">Log in to continue your CSE review.</p>
        </div>
        
        <form className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              placeholder="you@example.com" 
              className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500 transition" 
              required 
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <Link href="#" className="text-sm font-semibold text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500 transition" 
              required 
            />
          </div>
          
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition shadow-md mt-4">
            Sign In
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-600">
            Don't have an account?{" "}
            <Link href="/register" className="font-bold text-blue-600 hover:underline">
              Create one
            </Link>
          </p>
          <Link href="/dashboard" className="inline-block mt-6 text-sm font-medium text-slate-400 hover:text-slate-600 transition">
            &larr; Skip to Dashboard (Dev Mode)
          </Link>
        </div>
      </div>
    </div>
  );
}