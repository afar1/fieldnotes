-- Migration Script: Assign Existing Data to Your User Account
-- Run this BEFORE enabling RLS policies
--
-- STEP 1: Get your user ID from Supabase Dashboard:
--   - Go to Authentication → Users
--   - Find your user account
--   - Copy the UUID (looks like: 123e4567-e89b-12d3-a456-426614174000)
--   - Replace YOUR_USER_ID_HERE below with that UUID
--
-- STEP 2: Review the counts to see what will be updated
-- STEP 3: Uncomment the UPDATE statements to actually run them

-- Replace this with your actual user ID from Supabase Authentication → Users
\set user_id 'YOUR_USER_ID_HERE'

-- First, check what data exists without owner_id
SELECT 'Boards without owner_id:' as check_type, COUNT(*) as count 
FROM public.boards WHERE owner_id IS NULL
UNION ALL
SELECT 'Board columns without owner_id:', COUNT(*) 
FROM public.board_columns WHERE owner_id IS NULL
UNION ALL
SELECT 'Todos without owner_id:', COUNT(*) 
FROM public.todos WHERE owner_id IS NULL;

-- Verify the user ID exists
SELECT 'User exists:' as check_type, COUNT(*) as count
FROM auth.users WHERE id = :'user_id';

-- Once you've verified the counts and user ID, uncomment these to actually update:

-- Assign all boards without owner_id to your user
-- UPDATE public.boards 
-- SET owner_id = :'user_id'::uuid 
-- WHERE owner_id IS NULL;

-- Assign all board_columns without owner_id to your user
-- UPDATE public.board_columns 
-- SET owner_id = :'user_id'::uuid 
-- WHERE owner_id IS NULL;

-- Assign all todos without owner_id to your user
-- UPDATE public.todos 
-- SET owner_id = :'user_id'::uuid 
-- WHERE owner_id IS NULL;

-- Verify the updates worked
-- SELECT 'Boards now owned by you:' as check_type, COUNT(*) as count 
-- FROM public.boards WHERE owner_id = :'user_id'::uuid
-- UNION ALL
-- SELECT 'Board columns now owned by you:', COUNT(*) 
-- FROM public.board_columns WHERE owner_id = :'user_id'::uuid
-- UNION ALL
-- SELECT 'Todos now owned by you:', COUNT(*) 
-- FROM public.todos WHERE owner_id = :'user_id'::uuid;

