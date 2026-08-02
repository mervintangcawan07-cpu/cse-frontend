import { NextResponse } from "next/server";
import { runCSCSynchronization } from "@/lib/cscSyncEngine";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const isCronKeyValid = authHeader === `Bearer ${process.env.CRON_SECRET_KEY}`;

    let isAdmin = false;
    if (!isCronKeyValid) {
      const cookieStore = await cookies();
      const token = cookieStore.get("cse_session")?.value;
      if (token) {
        const session = await verifyJWT(token);
        isAdmin = session?.role === "ADMIN";
      }
    }

    if (!isCronKeyValid && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized sync trigger" }, { status: 401 });
    }

    const result = await runCSCSynchronization(isAdmin);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}