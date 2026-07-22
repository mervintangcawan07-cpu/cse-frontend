import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-8 border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">Create Account</h1>
          <p className="text-slate-500 mt-2">Start your journey to passing the CSE.</p>
        </div>
        
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
            <input 
              type="text" 
              placeholder="Juan Dela Cruz" 
              className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500 transition" 
              required 
            />
          </div>
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
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500 transition" 
              required 
            />
          </div>
          
          <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition shadow-md mt-6">
            Sign Up
          </button>
        </form>
        
        <p className="text-center text-sm text-slate-600 mt-8">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-blue-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}