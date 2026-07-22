import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the secure cookie exists
  const session = request.cookies.get('cse_session');

  // If there is no session cookie, redirect to the login/settings page
  if (!session) {
    return NextResponse.redirect(new URL('/settings', request.url));
  }

  // Otherwise, allow the request to proceed
  return NextResponse.next();
}

// Specify exactly which routes the middleware should protect
export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/mock-exam/:path*',
    '/admin/:path*'
  ],
};