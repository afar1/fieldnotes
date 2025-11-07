-- Test Script: Verify Data Before Enabling RLS
-- Run this BEFORE running supabase-rls-policies.sql
-- This will show you exactly what data you have and confirm it's safe

DO $$
DECLARE
    target_user_id uuid := '124d5d6c-a27e-4fa0-9a39-7f6adb9109d4';
    board_count integer;
    column_count integer;
    todo_count integer;
BEGIN
    RAISE NOTICE '=== Pre-RLS Data Check ===';
    RAISE NOTICE '';
    
    -- Count your data
    SELECT COUNT(*) INTO board_count FROM public.boards WHERE owner_id = target_user_id;
    SELECT COUNT(*) INTO column_count FROM public.board_columns WHERE owner_id = target_user_id;
    SELECT COUNT(*) INTO todo_count FROM public.todos WHERE owner_id = target_user_id;
    
    RAISE NOTICE 'Your data counts:';
    RAISE NOTICE '  - Boards: %', board_count;
    RAISE NOTICE '  - Board Columns: %', column_count;
    RAISE NOTICE '  - Todos: %', todo_count;
    RAISE NOTICE '';
    
    -- Check if RLS is already enabled
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'boards' 
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE '⚠ RLS is already enabled on boards table';
    ELSE
        RAISE NOTICE '✓ RLS is NOT enabled yet (safe to proceed)';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== What RLS Will Do ===';
    RAISE NOTICE 'RLS policies will:';
    RAISE NOTICE '  ✓ Allow YOU to see all % boards', board_count;
    RAISE NOTICE '  ✓ Allow YOU to see all % board columns', column_count;
    RAISE NOTICE '  ✓ Allow YOU to see all % todos', todo_count;
    RAISE NOTICE '  ✓ Block OTHER users from seeing your data';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS policies will NOT:';
    RAISE NOTICE '  ✗ Delete any data';
    RAISE NOTICE '  ✗ Modify any data';
    RAISE NOTICE '  ✗ Change any owner_id values';
    RAISE NOTICE '';
    RAISE NOTICE '=== Safety Check ===';
    IF board_count > 0 AND column_count > 0 AND todo_count > 0 THEN
        RAISE NOTICE '✓ You have data assigned to your account';
        RAISE NOTICE '✓ Safe to enable RLS - your data will remain accessible to you';
    ELSE
        RAISE NOTICE '⚠ WARNING: You have no data assigned to your account!';
        RAISE NOTICE '  Make sure you ran migrate-existing-data-simple.sql first';
    END IF;
END $$;

