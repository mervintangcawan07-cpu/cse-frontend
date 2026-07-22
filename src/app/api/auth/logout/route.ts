import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully" }, { status: 200 });
  
  // Clear the cookie by setting its expiration to the past
  response.cookies.set("cse_session", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  return response;
}