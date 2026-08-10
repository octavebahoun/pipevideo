import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/session';
import LoginClient from './LoginClient';

export default async function LoginPage() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const userId = token ? await verifySession(token) : null;

  if (userId) {
    redirect('/dashboard');
  }

  return <LoginClient />;
}
