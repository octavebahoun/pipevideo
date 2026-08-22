import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/session';

// Routes n8n calls back into from outside (no browser session available).
// Protected below by a shared secret instead of the session cookie.
// Appelées par n8n depuis l'extérieur, sans cookie : le secret partagé fait foi.
const EXTERNAL_WEBHOOK_PATHS = ['/api/webhook/storyboard', '/api/webhook/telegram'];

// Routes ouvertes AUX DEUX : le dashboard les appelle avec un cookie de session,
// n8n avec le secret partagé. Les lister dans EXTERNAL_WEBHOOK_PATHS aurait
// rejeté le dashboard (pas de secret côté navigateur) et cassé le bouton
// « Rendre » ; les laisser en session seule aurait rejeté n8n.
const DUAL_AUTH_PATHS = ['/api/render'];

// Only the login/logout endpoints stay fully open — every other /api/* route
// (including /api/webhook/idea, which is triggered by the authenticated
// dashboard UI, not by n8n) requires a valid session same as the pages do.
const PUBLIC_API_PATHS = ['/api/auth/login', '/api/auth/logout'];

function isAuthorizedWebhook(request: NextRequest): boolean {
  const expected = process.env.N8N_WEBHOOK_SECRET;
  // Fail closed: without a configured secret, the external webhook stays locked.
  if (!expected) return false;
  return request.headers.get('x-webhook-secret') === expected;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (PUBLIC_API_PATHS.some((p) => pathname === p)) {
      return NextResponse.next();
    }

    if (EXTERNAL_WEBHOOK_PATHS.some((p) => pathname === p)) {
      if (isAuthorizedWebhook(request)) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Secret partagé accepté ici EN PLUS de la session, dont la vérification
    // suit juste en dessous si le secret est absent.
    if (DUAL_AUTH_PATHS.some((p) => pathname === p) && isAuthorizedWebhook(request)) {
      return NextResponse.next();
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const userId = token ? await verifySession(token) : null;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const userId = token ? await verifySession(token) : null;

  if (!userId) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/editor/:path*', '/api/:path*'],
};
