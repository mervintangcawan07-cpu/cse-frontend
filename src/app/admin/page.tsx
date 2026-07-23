export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-4">Admin Dashboard</h1>
      <p className="text-slate-600 mb-8">
        Welcome to the control center. From here, you can manage exam modules, add questions, and oversee premium user subscriptions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Question Bank</h2>
          <p className="text-sm text-slate-500 mb-4">Add, edit, or delete Civil Service Exam review questions.</p>
          <a
            href="/admin/questions"
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Manage Questions
          </a>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">User Subscriptions</h2>
          <p className="text-sm text-slate-500 mb-4">View registered users and active premium (`isPaid`) accounts.</p>
          <a
            href="/admin/users"
            className="inline-block px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
          >
            View Users
          </a>
        </div>
      </div>
    </div>
  );
}