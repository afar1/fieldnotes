-- Simple Migration: Assign All Existing Data to Your User
-- Run this BEFORE enabling RLS policies
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Find your user account and copy the UUID (the ID column)
-- 3. Replace 'YOUR_USER_ID_HERE' below with your actual UUID
-- 4. Run this script in Supabase SQL Editor

-- User UUID from Authentication → Users
DO $$
DECLARE
    target_user_id uuid := '124d5d6c-a27e-4fa0-9a39-7f6adb9109d4';
BEGIN
    -- Verify user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'User ID % does not exist. Please check Authentication → Users.', target_user_id;
    END IF;

    -- Show what will be updated
    RAISE NOTICE 'Boards without owner_id: %', (SELECT COUNT(*) FROM public.boards WHERE owner_id IS NULL);
    RAISE NOTICE 'Board columns without owner_id: %', (SELECT COUNT(*) FROM public.board_columns WHERE owner_id IS NULL);
    RAISE NOTICE 'Todos without owner_id: %', (SELECT COUNT(*) FROM public.todos WHERE owner_id IS NULL);

    -- Assign all existing data to your user
    UPDATE public.boards 
    SET owner_id = target_user_id 
    WHERE owner_id IS NULL;

    UPDATE public.board_columns 
    SET owner_id = target_user_id 
    WHERE owner_id IS NULL;

    UPDATE public.todos 
    SET owner_id = target_user_id 
    WHERE owner_id IS NULL;

    -- Show results
    RAISE NOTICE 'Migration complete!';
    RAISE NOTICE 'Boards now owned by you: %', (SELECT COUNT(*) FROM public.boards WHERE owner_id = target_user_id);
    RAISE NOTICE 'Board columns now owned by you: %', (SELECT COUNT(*) FROM public.board_columns WHERE owner_id = target_user_id);
    RAISE NOTICE 'Todos now owned by you: %', (SELECT COUNT(*) FROM public.todos WHERE owner_id = target_user_id);
END $$;

