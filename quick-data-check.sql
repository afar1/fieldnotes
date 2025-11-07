-- Quick Data Check - Shows results in Results tab
-- Run this to see your data counts before enabling RLS

SELECT 
    'Boards owned by you' as data_type,
    COUNT(*) as count
FROM public.boards 
WHERE owner_id = '124d5d6c-a27e-4fa0-9a39-7f6adb9109d4'

UNION ALL

SELECT 
    'Board columns owned by you',
    COUNT(*)
FROM public.board_columns 
WHERE owner_id = '124d5d6c-a27e-4fa0-9a39-7f6adb9109d4'

UNION ALL

SELECT 
    'Todos owned by you',
    COUNT(*)
FROM public.todos 
WHERE owner_id = '124d5d6c-a27e-4fa0-9a39-7f6adb9109d4'

UNION ALL

SELECT 
    'Boards with NO owner (should be 0)',
    COUNT(*)
FROM public.boards 
WHERE owner_id IS NULL

UNION ALL

SELECT 
    'Board columns with NO owner (should be 0)',
    COUNT(*)
FROM public.board_columns 
WHERE owner_id IS NULL

UNION ALL

SELECT 
    'Todos with NO owner (should be 0)',
    COUNT(*)
FROM public.todos 
WHERE owner_id IS NULL;

