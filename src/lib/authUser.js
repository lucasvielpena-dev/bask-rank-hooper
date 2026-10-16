import { supabase } from './supabase';

/** Resolve auth user id with getUser -> getSession fallbacks (mobile-safe). */
export async function resolveAuthUserId() {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch (_) {}
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) return data.session.user.id;
  } catch (_) {}
  return null;
}

export async function resolveAuthUser() {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) return data.user;
  } catch (_) {}
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) return data.session.user;
  } catch (_) {}
  return null;
}
