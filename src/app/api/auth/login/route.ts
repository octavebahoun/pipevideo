import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, signSession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Same generic error whether the email doesn't exist or the password is
    // wrong — don't leak which one it was.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    const token = await signSession(user.id);
    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });
    return res;
  } catch (error: any) {
    console.error('Error during login:', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
