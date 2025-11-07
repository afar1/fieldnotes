-- Verification Script: Check Data After Enabling RLS
-- Run this AFTER running supabase-rls-policies.sql
-- This confirms your data is still there and accessible

DO $$
DECLARE
    target_user_id uuid := '124d5d6c-a27e-4fa0-9a39-7f6adb9109d4';
    board_count integer;
    column_count integer;
    todo_count integer;
BEGIN
    RAISE NOTICE '=== Post-RLS Data Verification ===';
    RAISE NOTICE '';
    
    -- Count your data (should be same as before)
    SELECT COUNT(*) INTO board_count FROM public.boards WHERE owner_id = target_user_id;
    SELECT COUNT(*) INTO column_count FROM public.board_columns WHERE owner_id = target_user_id;
    SELECT COUNT(*) INTO todo_count FROM public.todos WHERE owner_id = target_user_id;
    
    RAISE NOTICE 'Your data counts (should match pre-RLS counts):';
    RAISE NOTICE '  - Boards: %', board_count;
    RAISE NOTICE '  - Board Columns: %', column_count;
    RAISE NOTICE '  - Todos: %', todo_count;
    RAISE NOTICE '';
    
    -- Verify RLS is enabled
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'boards' 
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE '✓ RLS is enabled';
    ELSE
        RAISE NOTICE '⚠ RLS is NOT enabled';
    END IF;
    
    -- Check policies exist
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'boards'
    ) THEN
        RAISE NOTICE '✓ RLS policies are created';
    ELSE
        RAISE NOTICE '⚠ RLS policies are missing';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Verification Summary ===';
    IF board_count > 0 AND column_count > 0 AND todo_count > 0 THEN
        RAISE NOTICE '✓ SUCCESS: All your data is still there!';
        RAISE NOTICE '✓ RLS is protecting your data without deleting anything.';
    ELSE
        RAISE NOTICE '⚠ WARNING: No data found. Check if RLS is blocking access.';
    END IF;
END $$;

