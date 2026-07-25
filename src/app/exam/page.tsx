import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExamPage() {
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
    select: { id: true, role: true, isPaid: true },
  });

  if (!user) {
    redirect("/login");
  }

  const isPaid = user.isPaid || user.role === "ADMIN";

  // Redirect unpaid users to the dashboard preview where they can pay
  if (!isPaid) {
    redirect("/dashboard");
  }

  // Proceed directly to the mock exam player for PRO users
  redirect("/mock-exam/take");
}