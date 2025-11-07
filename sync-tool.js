 // Plain-English overview:
     // 1. Load the exported JSON
     // 2. Flatten all todo items into rows our Supabase tables expect
     // 3. Submit them with a single insert using the service-role key

     import fs from 'fs';
     import { createClient } from '@supabase/supabase-js';

     // === Fill these in before running ===
     const SUPABASE_URL = process.env.SUPABASE_URL;
     const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
     const BOARD_ID = '00000000-0000-0000-0000-000000000001'; // change if you used a different id
     const COLUMN_IDS = {
       do: '...',     // paste from the select query
       done: '...',
       ignore: '...',
       others: '...',
     };

     // === Step 1: load export ===
     const raw = fs.readFileSync('./my-todos-export.json', 'utf8');
     const saved = JSON.parse(raw);

     // saved.columns matches the structure our React app uses
     const columns = saved.columns;

     // === Step 2: flatten items ===
     const rows = [];

     for (const [slug, columnData] of Object.entries(columns)) {
       const columnId = COLUMN_IDS[slug];
       if (!columnId) continue; // skip ember or anything else we aren't storing now

       columnData.items.forEach((item, index) => {
         rows.push({
           board_id: BOARD_ID,
           column_id: columnId,
           text: item.text ?? '',
           position: index + 1, // simplest ordering; grow later if needed
           created_at: item.createdAt || new Date().toISOString(),
           updated_at: item.updatedAt || new Date().toISOString(),
           completed_at: item.completedAt ?? null,
           metadata: item.metadata ?? null,
         });
       });
     }

     // === Step 3: insert into Supabase ===
     const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

     const { error } = await supabase
       .from('todos')
       .insert(rows);

     if (error) {
       console.error('Failed to import todos', error);
       process.exit(1);
     }

     console.log(`Imported ${rows.length} todos successfully.`);