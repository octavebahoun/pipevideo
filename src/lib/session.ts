import { SignJWT, jwtVerify } from 'jose';

/**
 * Edge-safe session helpers: only depends on `jose`, so this module can be
 * imported from src/middleware.ts (Edge runtime). Password hashing (bcryptjs,
 * Node-only APIs) lives in src/lib/auth.ts instead, imported only from
 * regular API routes.
 */

export const SESSION_COOKIE_NAME = 'session';
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in .env');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

/** Returns the userId encoded in the token, or null if invalid/expired. */
export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.userId === 'string' ? payload.userId : null;
  } catch {
    return null;
  }
}
