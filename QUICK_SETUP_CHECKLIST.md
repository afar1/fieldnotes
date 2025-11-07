# Quick Setup Checklist

## Supabase Dashboard Tasks

- [ ] **Authentication → Providers**: Enable "Email" provider
- [ ] **Authentication → URL Configuration**:
  - Site URL: `https://field-alpha.vercel.app`
  - Redirect URLs: Add `https://field-alpha.vercel.app/reset-password`
- [ ] **SQL Editor**: 
  - If you have existing data: Run `migrate-existing-data-simple.sql` first (assigns data to your user)
  - Then run `supabase-rls-policies.sql` script
- [ ] **Database → Replication**: Enable for `public.todos` (OPTIONAL - enables live updates across sessions)

## Vercel Dashboard Tasks

- [ ] **Settings → Environment Variables**: Add for Production, Preview, Development:
  - `NEXT_PUBLIC_SUPABASE_URL` = (from Supabase Settings → API → Project URL)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (from Supabase Settings → API → anon public key)
- [ ] **Settings → Git**: Verify branch is `feature/auth-flow` (or set to main when ready)
- [ ] **Deployments**: Trigger a new production deployment

## Testing Checklist

- [ ] Visit `https://field-alpha.vercel.app` → redirects to `/login`
- [ ] Create test user in Supabase (Authentication → Users → Add user)
- [ ] Sign in with test user → redirects to `/` (board)
- [ ] Create a todo → verify it appears in Supabase Table Editor
- [ ] Open app in two windows → create todo in one → verify appears in other (Realtime test - only if Realtime enabled)

## Files Created

- `supabase-rls-policies.sql` - RLS policies to run in Supabase SQL Editor
- `DEPLOYMENT.md` - Detailed deployment guide
- `QUICK_SETUP_CHECKLIST.md` - This checklist

