-- Verification Script: Check if Migration Worked
-- Run this AFTER running migrate-existing-data-simple.sql
-- This will show you what data is assigned to your account

-- Your user ID (from migrate-existing-data-simple.sql)
\set user_id '124d5d6c-a27e-4fa0-9a39-7f6adb9109d4'

-- Check 1: Count data WITH owner_id (should be > 0 after migration)
SELECT 
    'Boards with owner_id' as table_name,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE owner_id = :'user_id'::uuid) as your_data_count,
    COUNT(*) FILTER (WHERE owner_id IS NOT NULL AND owner_id != :'user_id'::uuid) as other_users_count,
    COUNT(*) FILTER (WHERE owner_id IS NULL) as no_owner_count
FROM public.boards
UNION ALL
SELECT 
    'Board columns with owner_id',
    COUNT(*),
    COUNT(*) FILTER (WHERE owner_id = :'user_id'::uuid),
    COUNT(*) FILTER (WHERE owner_id IS NOT NULL AND owner_id != :'user_id'::uuid),
    COUNT(*) FILTER (WHERE owner_id IS NULL)
FROM public.board_columns
UNION ALL
SELECT 
    'Todos with owner_id',
    COUNT(*),
    COUNT(*) FILTER (WHERE owner_id = :'user_id'::uuid),
    COUNT(*) FILTER (WHERE owner_id IS NOT NULL AND owner_id != :'user_id'::uuid),
    COUNT(*) FILTER (WHERE owner_id IS NULL)
FROM public.todos;

-- Check 2: Sample data to verify owner_id is set correctly
SELECT 'Sample boards assigned to you:' as check_type;
SELECT id, name, owner_id, created_at 
FROM public.boards 
WHERE owner_id = :'user_id'::uuid
LIMIT 5;

SELECT 'Sample board columns assigned to you:' as check_type;
SELECT id, slug, name, board_id, owner_id 
FROM public.board_columns 
WHERE owner_id = :'user_id'::uuid
LIMIT 5;

SELECT 'Sample todos assigned to you:' as check_type;
SELECT id, text, board_id, column_id, owner_id, created_at 
FROM public.todos 
WHERE owner_id = :'user_id'::uuid
LIMIT 5;

-- Check 3: Verify user exists
SELECT 'User verification:' as check_type;
SELECT id, email, created_at 
FROM auth.users 
WHERE id = :'user_id'::uuid;

