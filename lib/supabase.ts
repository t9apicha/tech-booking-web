import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const db = createClient(supabaseUrl, supabaseKey);

export type UserRole = 'customer' | 'technician' | 'admin';

export function saveSession(role: UserRole, user: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('app_role', role);
    localStorage.setItem('app_user', JSON.stringify(user));
  }
}

export function getSession<T>(expectedRole: UserRole): T | null {
  if (typeof window === 'undefined') return null;
  const role = localStorage.getItem('app_role');
  const userStr = localStorage.getItem('app_user');
  if (!role || !userStr || role !== expectedRole) {
    return null;
  }
  return JSON.parse(userStr) as T;
}

export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('app_role');
    localStorage.removeItem('app_user');
  }
}