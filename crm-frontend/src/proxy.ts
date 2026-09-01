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
     * - favicon.ico, favicon/ directory (browser icons)
     * - manifest.json (PWA manifest)
     * - logo/, lottie/, font/ (static assets)
     * - icons/, images/ (static assets)
     * - *.png, *.jpg, *.jpeg, *.svg, *.webp, *.ico (image files)
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|favicon/|manifest\\.json|logo|lottie|font|icons|images|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.webp$|.*\\.ico$).*)',
  ],
};
