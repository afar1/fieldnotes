<!-- ed87f8c1-05e4-435f-b05f-cfbaec83da12 ce2af9b1-cc90-4070-9875-52181ff23e3c -->
# Expo Mobile Do/Done MVP (Supabase, iOS only)

## Why this plan fits your principles

- Root cause: Need a mobile-first interface without duplicating backend logic. We reuse the proven Supabase model and keep mobile a thin UI layer.
- Preserve working code: Web stays untouched; we don’t fork logic. Mobile calls the same tables/constraints and RLS.
- Single source of truth: All business logic lives in Supabase; mobile adds small, well-named functions, not layers.
- Time-boxed simplicity: No realtime/offline, no multi-board. Ship Do/Done with add/edit/toggle/reorder.
- Structure over features: Minimal files, minimal deps, boring patterns.

## Scope (MVP)

- iOS-only. Single primary board. Two columns: Do and Done.
- Interactions: quick add, tap-to-edit, swipe right to toggle, long-press reorder (persisted via position).
- No realtime, no offline caching, no theming. Manual refresh acceptable.

## What we will NOT do (now)

- No expo-router (single stack Auth → Board).
- No realtime subscriptions, push, or offline queueing.
- No multi-board UI, search, tags, or theming.
- No shared core library extraction yet (avoid premature abstraction).

## Architecture (simple and boring)

- Expo managed workflow, TypeScript.
- Minimal deps: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-draggable-flatlist`.
- Env via `app.config.ts` extras: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `BOARD_SLUG`.
- Screens: `AuthScreen` (email/password) → `BoardScreen` (segmented Do/Done).

## Data model & functions (thin wrappers)

- Choose primary board: first user-owned or by `BOARD_SLUG`.
- Resolve `do`/`done` column IDs once and cache in memory.
- Functions (plain, testable):
  - `getPrimaryBoard()`
  - `getDoDoneColumns(boardId)`
  - `listTodos(boardId, columnId)` ordered by `position desc, created_at desc`
  - `insertTodo(boardId, columnId, text, position)`
  - `updateTodoText(id, text)`
  - `moveTodoToColumn(id, targetColumnId, position)`
  - `updateTodoPosition(id, position)`

### Essential position logic (1000-step spacing)

```ts
function computeNewPosition(index: number, items: { position: number }[]): number {
  if (index === 0) {
    const top = items.length ? items[0].position : 0;
    return top + 1000; // new top
  }
  if (index >= items.length) {
    const bottom = items[items.length - 1]?.position ?? 0;
    return Math.max(bottom - 1000, 0); // new bottom
  }
  const prev = items[index - 1].position;
  const next = items[index].position;
  return Math.floor((prev + next) / 2); // between neighbors
}
```

## File structure to create

```
mobile/
├── app.config.ts            # expose SUPABASE_URL/ANON_KEY/BOARD_SLUG via extra
├── package.json
├── tsconfig.json
├── App.tsx                  # minimal navigator: Auth → Board
└── src/
    ├── services/
    │   ├── supabase.ts      # RN client with AsyncStorage auth storage
    │   └── database.ts      # thin functions above
    ├── screens/
    │   ├── AuthScreen.tsx
    │   └── BoardScreen.tsx  # segmented Do/Done, lists, quick add
    ├── components/
    │   ├── TodoRow.tsx      # swipe-to-toggle, tap-to-edit
    │   └── ReorderList.tsx  # DraggableFlatList wrapper
    └── utils/
        └── position.ts      # computeNewPosition (if not inline)
```

## Implementation steps (time-boxed)

1) Setup (30m): Init Expo TS app under `mobile/`, install minimal deps, enable gesture/reanimated.

2) Config (15m): `app.config.ts` extras; create `supabase.ts` with AsyncStorage.

3) Auth (45m): `AuthScreen` email/password; persist session; guard Board.

4) Data functions (45m): Implement 7 thin calls and basic error handling.

5) Board UI (60m): Segmented Do/Done, FlatList per segment, empty states.

6) Interactions (60-90m):

   - Quick add at top (insert at computed top position).
   - Swipe right to toggle columns (move to top of target).
   - Long-press reorder within column (persist new position only for moved row).

7) Polish (30m): SafeArea, keyboard avoidance, small haptics (optional).

8) Manual QA (30m): Add/toggle/reorder/edit; reload verifies persistence.

Total: ~4–5 hours focused, single day calendar time.

## Risks & mitigations

- RN gestures setup friction → stick to widely used libs; keep gestures simple.
- Position saturation (rare) → skip renormalization for MVP; revisit only if needed.
- Board/column discovery mismatch → show clear blocking error with a one-tap retry after user fixes data.

### To-dos

- [ ] Initialize Expo TS app and install minimal dependencies
- [ ] Add app.config.ts and Supabase client using AsyncStorage
- [ ] Build email/password AuthScreen with session persistence
- [ ] Implement thin Supabase data functions for board/columns/todos
- [ ] Create BoardScreen with segmented Do/Done and FlatLists
- [ ] Add quick-add input to insert at top with position logic
- [ ] Enable swipe right to toggle item between Do and Done
- [ ] Add long-press reorder via DraggableFlatList and persist position
- [ ] Implement tap-to-edit text with save on blur/submit
- [ ] Add SafeArea/keyboard handling and run iOS simulator QA