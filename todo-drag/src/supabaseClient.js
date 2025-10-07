import { createClient } from '@supabase/supabase-js';

const resolveEnv = (keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }

  if (typeof window !== 'undefined') {
    for (const key of keys) {
      const candidate = window[key] || window?.__env?.[key];
      if (candidate) return candidate;
    }
  }

  return undefined;
};

const url = resolveEnv(['NEXT_PUBLIC_SUPABASE_URL', 'REACT_APP_SUPABASE_URL']);
const anonKey = resolveEnv(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY']);

if (!url || !anonKey) {
  throw new Error('Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(url, anonKey);
