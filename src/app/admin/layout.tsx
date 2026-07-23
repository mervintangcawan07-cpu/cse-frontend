import { redirect } from "next/navigation";
// If you use a session helper like NextAuth, import your auth function here.
// For this example, we'll outline the structural pattern for role verification.

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Replace this with your actual session or token check (e.g., const session = await auth();)
  // Example verification mock:
  const userRole = "ADMIN"; // Change this logic to check your real user session / database role
  const isAuthenticated = true; // Change based on your auth implementation

  if (!isAuthenticated || userRole !== "ADMIN") {
    redirect("/"); // Kick non-admins back to the home page
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:block">
        <h2 className="text-xl font-bold mb-6">Admin Panel</h2>
        <nav className="space-y-3">
          <a href="/admin" className="block py-2 px-3 rounded hover:bg-slate-800 transition">
            Dashboard Overview
          </a>
          <a href="/admin/questions" className="block py-2 px-3 rounded hover:bg-slate-800 transition">
            Manage Questions
          </a>
          <a href="/admin/users" className="block py-2 px-3 rounded hover:bg-slate-800 transition">
            User Management & Paid Status
          </a>
        </nav>
      </aside>

      {/* Main Admin Content Area */}
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}