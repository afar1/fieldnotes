# Field Alpha Deployment Guide

## Prerequisites

- Supabase project with database schema already created
- Vercel account with access to `field-alpha` project
- Git repository connected to Vercel

## Step 1: Supabase Configuration

### 1.1 Enable Email/Password Authentication

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Email** provider
4. Configure email settings (SMTP) if needed for production

### 1.2 Configure Auth URLs

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `https://field-alpha.vercel.app`
3. Add **Redirect URLs**:
   - `https://field-alpha.vercel.app/reset-password`
   - `https://field-alpha.vercel.app/**` (wildcard for all routes)

### 1.3 Enable Realtime (Optional)

**Note**: Realtime is optional. The app works without it, but users won't see live updates across multiple browser sessions/devices. Without Realtime, users need to refresh to see changes made elsewhere.

If you have Realtime available:
1. Go to **Database** → **Replication**
2. Enable replication for:
   - `public.todos` (enables live updates across sessions)
   - `public.boards` (optional, for multi-board support)
   - `public.board_columns` (optional)

If Realtime is not available, skip this step. The app will still function normally.

### 1.4 Migrate Existing Data (If Needed)

**If you have existing data in your database without `owner_id` set:**

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Find your user account and copy the UUID (the ID column)
3. Go to **SQL Editor**
4. Open `migrate-existing-data-simple.sql`
5. Replace `YOUR_USER_ID_HERE` with your actual user UUID
6. Run the script to assign all existing data to your account
7. Verify the counts shown in the output

**If you're starting fresh or all data already has `owner_id`, skip this step.**

### 1.5 Set Up Row Level Security (RLS)

1. Go to **SQL Editor** in Supabase dashboard
2. Copy and paste the contents of `supabase-rls-policies.sql`
3. Run the SQL script
4. Verify policies are created in **Database** → **Tables** → [table] → **Policies**

## Step 2: Vercel Configuration

### 2.1 Add Environment Variables

1. Go to Vercel dashboard → `field-alpha` project
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables for **Production**, **Preview**, and **Development**:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Where to find these values:**
- Supabase Dashboard → **Settings** → **API**
- `NEXT_PUBLIC_SUPABASE_URL`: Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `anon` `public` key

### 2.2 Connect Repository/Branch

1. In Vercel project settings, go to **Git**
2. Ensure repository is connected
3. Set **Production Branch** to `feature/auth-flow` (or `main` when ready)
4. Verify **Build Command** and **Output Directory** match `vercel.json`:
   - Build Command: `cd todo-drag && npm install && npm run build`
   - Output Directory: `todo-drag/build`

## Step 3: Deploy

### 3.1 Trigger Deployment

1. Push any pending changes to the connected branch
2. Vercel will auto-deploy, OR
3. Manually trigger deployment from Vercel dashboard → **Deployments** → **Redeploy**

### 3.2 Verify Build

- Check build logs for errors
- Ensure environment variables are loaded (check build logs)
- Verify build completes successfully

## Step 4: Testing

### 4.1 Create Test User

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter email and temporary password
4. User will need to reset password on first login

### 4.2 Test Authentication Flow

1. Visit `https://field-alpha.vercel.app`
2. Should redirect to `/login`
3. Sign in with test user credentials
4. Should redirect to `/` (main board)

### 4.3 Test Database Operations

1. Create a new todo item
2. Verify it appears in Supabase Dashboard → **Table Editor** → `todos`
3. Check that `owner_id` matches your user ID
4. Verify RLS: Try querying todos from another user's account (should return empty)

### 4.4 Test Realtime (if enabled)

**Note**: This test only applies if you enabled Realtime replication.

1. Open app in two browser windows (or incognito + regular)
2. Sign in with same user in both
3. Create/update a todo in one window
4. Should appear in other window without refresh

**Without Realtime**: Changes will only appear after refreshing the page.

## Troubleshooting

### Auth redirects not working
- Verify Site URL and Redirect URLs in Supabase match exactly
- Check browser console for auth errors
- Verify environment variables are set correctly in Vercel

### RLS blocking operations
- Check Supabase logs: **Logs** → **Postgres Logs**
- Verify `owner_id` is being set correctly in app code
- Check policies are enabled: `SELECT * FROM pg_policies WHERE tablename = 'todos';`

### Realtime not working
- Verify Realtime is enabled in Supabase dashboard
- Check browser console for WebSocket connection errors
- Verify `board_id` filter in `BoardApp.js` matches your board ID

### Build failures
- Check `vercel.json` build configuration
- Verify `package.json` dependencies are correct
- Check build logs for specific error messages

## Next Steps

- [ ] Add Google OAuth provider (optional)
- [ ] Set up custom domain (if needed)
- [ ] Configure email templates in Supabase
- [ ] Set up monitoring/error tracking
- [ ] Clean up unused IndexedDB code after verification

