-- Simple Verification: Check if Migration Worked
-- Run this AFTER running migrate-existing-data-simple.sql

-- Your user ID
DO $$
DECLARE
    target_user_id uuid := '124d5d6c-a27e-4fa0-9a39-7f6adb9109d4';
BEGIN
    RAISE NOTICE '=== Migration Verification ===';
    RAISE NOTICE '';
    
    -- Check if user exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
        RAISE NOTICE '✓ User exists: %', target_user_id;
    ELSE
        RAISE NOTICE '✗ User does NOT exist: %', target_user_id;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Data Counts ===';
    
    -- Boards
    RAISE NOTICE 'Boards:';
    RAISE NOTICE '  - Total: %', (SELECT COUNT(*) FROM public.boards);
    RAISE NOTICE '  - Owned by you: %', (SELECT COUNT(*) FROM public.boards WHERE owner_id = target_user_id);
    RAISE NOTICE '  - No owner: %', (SELECT COUNT(*) FROM public.boards WHERE owner_id IS NULL);
    
    -- Board columns
    RAISE NOTICE 'Board Columns:';
    RAISE NOTICE '  - Total: %', (SELECT COUNT(*) FROM public.board_columns);
    RAISE NOTICE '  - Owned by you: %', (SELECT COUNT(*) FROM public.board_columns WHERE owner_id = target_user_id);
    RAISE NOTICE '  - No owner: %', (SELECT COUNT(*) FROM public.board_columns WHERE owner_id IS NULL);
    
    -- Todos
    RAISE NOTICE 'Todos:';
    RAISE NOTICE '  - Total: %', (SELECT COUNT(*) FROM public.todos);
    RAISE NOTICE '  - Owned by you: %', (SELECT COUNT(*) FROM public.todos WHERE owner_id = target_user_id);
    RAISE NOTICE '  - No owner: %', (SELECT COUNT(*) FROM public.todos WHERE owner_id IS NULL);
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Verification Summary ===';
    
    IF (SELECT COUNT(*) FROM public.boards WHERE owner_id IS NULL) = 0 
       AND (SELECT COUNT(*) FROM public.board_columns WHERE owner_id IS NULL) = 0
       AND (SELECT COUNT(*) FROM public.todos WHERE owner_id IS NULL) = 0 THEN
        RAISE NOTICE '✓ SUCCESS: All data has owner_id assigned!';
        RAISE NOTICE '✓ Safe to proceed with RLS policies.';
    ELSE
        RAISE NOTICE '⚠ WARNING: Some data still has NULL owner_id.';
        RAISE NOTICE '  Review the counts above before enabling RLS.';
    END IF;
END $$;

