import Link from "next/link";

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-8">
          <Link href="/pricing" className="text-blue-600 font-semibold hover:underline">
            &larr; Back to Pricing
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4">Secure Checkout</h1>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Payment Details (Left Column) */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-xl font-bold text-slate-800 mb-6">Payment Method</h2>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 border border-blue-500 bg-blue-50 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input type="radio" name="payment" className="w-5 h-5 text-blue-600" defaultChecked />
                    <span className="font-bold text-slate-800">GCash</span>
                  </div>
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">PayMongo</span>
                </label>

                <label className="flex items-center justify-between p-4 border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition">
                  <div className="flex items-center gap-3">
                    <input type="radio" name="payment" className="w-5 h-5" />
                    <span className="font-bold text-slate-800">Maya</span>
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition">
                  <div className="flex items-center gap-3">
                    <input type="radio" name="payment" className="w-5 h-5" />
                    <span className="font-bold text-slate-800">Credit / Debit Card</span>
                  </div>
                </label>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Billing Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">First Name</label>
                    <input type="text" defaultValue="Maria" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Last Name</label>
                    <input type="text" defaultValue="Santos" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Email Address</label>
                    <input type="email" defaultValue="maria@example.com" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary (Right Column) */}
          <div className="md:col-span-1">
            <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-lg sticky top-8">
              <h2 className="text-lg font-bold mb-6 border-b border-slate-700 pb-4">Order Summary</h2>
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-semibold text-slate-100">Premium CSE Plan</p>
                  <p className="text-sm text-slate-400">Lifetime Access</p>
                </div>
                <p className="font-bold text-white">₱999.00</p>
              </div>
              
              <div className="flex justify-between items-center mb-6 text-sm">
                <p className="text-slate-400">Taxes & Fees</p>
                <p className="text-white">₱0.00</p>
              </div>

              <div className="flex justify-between items-center py-4 border-t border-slate-700 mb-6">
                <p className="font-bold text-lg text-slate-100">Total</p>
                <p className="font-extrabold text-2xl text-white">₱999.00</p>
              </div>

              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition shadow-md">
                Pay ₱999.00 Now
              </button>
              
              <p className="text-xs text-center text-slate-400 mt-4 flex items-center justify-center gap-1">
                🔒 Secured by PayMongo API
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}