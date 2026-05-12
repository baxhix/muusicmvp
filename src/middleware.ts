import { NextResponse, type NextRequest } from 'next/server';

/**
 * Allowlist of origins authorized to talk to /api/* with credentials.
 *
 * The admin panel lives at admin.muusic.live and shares the session
 * cookie (scoped to `.muusic.live`). Without CORS headers the browser
 * silently drops the response on every cross-origin fetch — even though
 * the cookie itself traverses fine — which surfaces as "API indisponível"
 * inside the admin app.
 *
 * Cross-origin-with-credentials specifically requires:
 *   - Access-Control-Allow-Origin: <exact origin> (NOT "*")
 *   - Access-Control-Allow-Credentials: true
 *   - OPTIONS preflight responses with the same headers
 *
 * Anything not on the list gets no CORS headers at all (same as before
 * — same-origin requests aren't affected).
 */
const ALLOWED_ORIGINS = new Set<string>([
  'https://admin.muusic.live',
  'https://painel.muusic.live', // reserved alias, harmless if unused
  // Allow localhost in dev so the admin app can be run standalone
  // against a remote API (designer workflow).
  'http://localhost:3001',
  'http://localhost:3010',
]);

function applyCors(res: NextResponse, origin: string): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set(
    'Access-Control-Allow-Methods',
    'GET,POST,PATCH,DELETE,OPTIONS',
  );
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization',
  );
  // Vary so any intermediate cache keys per origin instead of cross-mixing.
  res.headers.append('Vary', 'Origin');
  return res;
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    // Same-origin or unknown — let it through with no CORS headers.
    return NextResponse.next();
  }

  // Preflight: respond directly without hitting the API handler.
  if (req.method === 'OPTIONS') {
    return applyCors(new NextResponse(null, { status: 204 }), origin);
  }

  // Actual request: hand off to the handler and decorate the response.
  const res = NextResponse.next();
  return applyCors(res, origin);
}

export const config = {
  // Only API routes need CORS. Pages and static assets stay untouched.
  matcher: ['/api/:path*'],
};
