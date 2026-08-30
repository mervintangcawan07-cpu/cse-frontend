import { NextResponse } from "next/server";
import { runCSCSynchronization } from "@/lib/cscSyncEngine";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const isCronKeyValid = authHeader === `Bearer ${process.env.CRON_SECRET_KEY}`;

    let isAdmin = false;
    if (!isCronKeyValid) {
      const authenticatedUser = await getAuthenticatedUser();
      isAdmin = authenticatedUser?.role === "ADMIN";
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