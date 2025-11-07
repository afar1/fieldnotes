-- Quick Verification: Check if RLS is Enabled
-- Run this to confirm RLS policies are active

SELECT 
    'RLS Status' as check_type,
    tablename as table_name,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
AND tablename IN ('boards', 'board_columns', 'todos')
ORDER BY tablename;

