import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('crm_token')?.value;
  const isLoginPage = request.nextUrl.pathname === '/login';

  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - logo/ (logo files)
     * - lottie/ (lottie animation files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|logo|lottie|font).*)',
  ],
};
