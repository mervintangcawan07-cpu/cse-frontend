import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await verifyJWT(token);
  if (!session?.userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { role: true, name: true, email: true },
  });

  if (user?.role !== "ADMIN") {
    // Kicks regular users straight to the student dashboard
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-100/70">
      <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3 flex justify-between items-center text-xs font-semibold">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>ADMINISTRATOR CONTROL PANEL</span>
        </div>
        <span>Logged in as: <strong className="text-blue-400">{user.email}</strong></span>
      </div>
      <main>{children}</main>
    </div>
  );
}