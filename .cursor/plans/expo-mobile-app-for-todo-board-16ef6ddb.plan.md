<!-- 16ef6ddb-4edf-4cb9-8db2-2e88a290259b 41676ba7-7ff6-46c4-ae54-1caf4aca1a0f -->
# Expo Mobile App Implementation Plan

## Overview

Create a new Expo React Native mobile app in a `mobile/` directory that reuses the existing Supabase backend and authentication, but provides a mobile-optimized interface focused on DO and DONE columns only.

## Architecture Decisions

### Shared Code Strategy

- **Reuse**: Supabase client configuration (`supabaseClient.js`), auth context logic, and database service patterns
- **New**: Mobile-specific components using React Native primitives
- **Separate**: Mobile app lives in `mobile/` directory, independent from web app

### Key Libraries

- `expo` - Core Expo framework
- `react-native-gesture-handler` - For swipe gestures and long-press drag
- `react-native-reanimated` - For smooth animations
- `@react-native-async-storage/async-storage` - For local storage (replacing localStorage)
- `@supabase/supabase-js` - Already used in web, same version
- `expo-router` - For navigation (if needed) or simple single-screen app

## Implementation Steps

### 1. Project Setup

- Initialize Expo project in `mobile/` directory
- Configure `app.json` for iOS with proper bundle identifier
- Set up TypeScript configuration
- Install core dependencies: react-native-gesture-handler, react-native-reanimated, async-storage, supabase-js
- Configure environment variables for Supabase (same as web app)

### 2. Shared Services Layer

- Copy `supabaseClient.js` to `mobile/src/services/` (adapt for React Native environment variables)
- Copy `auth/AuthContext.js` logic, adapt to React Native (use AsyncStorage instead of localStorage if needed)
- Create `mobile/src/services/database.ts` that uses Supabase directly (simplified version, no Dexie needed for mobile)
- Create `mobile/src/hooks/useBoard.ts` - Hook to fetch DO/DONE items from Supabase, handle real-time updates

### 3. Core Components

#### 3.1 TodoItem Component (`mobile/src/components/TodoItem.tsx`)

- Tap to edit: When tapped, show TextInput inline
- Swipe right gesture: Use `react-native-gesture-handler` Swipeable component
  - Swipe right from DO → moves to DONE (sets completedAt timestamp)
  - Swipe right from DONE → moves back to DO (clears completedAt)
- Long press: Enable drag handle for reordering
- Visual feedback: Show swipe action indicator, highlight when editing

#### 3.2 TodoList Component (`mobile/src/components/TodoList.tsx`)

- Uses `react-native-gesture-handler` DraggableFlatList or similar for reordering
- Renders list of TodoItems
- Handles drag-to-reorder: Update position in Supabase when item is dropped
- Empty state: Shows quick-add input when list is empty

#### 3.3 ColumnView Component (`mobile/src/components/ColumnView.tsx`)

- Renders either DO or DONE column
- Header with column name and item count
- Contains TodoList component
- Quick-add input at bottom (always visible or appears on tap)

#### 3.4 MainScreen Component (`mobile/src/components/MainScreen.tsx`)

- Tab-based or segmented control to switch between DO and DONE views
- Or: Two-column layout side-by-side (if screen width allows)
- Or: Single column with toggle button (simpler, recommended for mobile)
- Handles authentication state (show login if not authenticated)

### 4. Gesture Implementation

#### 4.1 Swipe Gesture (`mobile/src/hooks/useSwipeToToggle.ts`)

- Use `react-native-gesture-handler` GestureDetector with PanGestureHandler
- Detect right swipe (threshold ~100px)
- Call toggle function: Move item between DO/DONE columns
- Animate item sliding out and feedback animation

#### 4.2 Long Press Drag (`mobile/src/hooks/useDragToReorder.ts`)

- Use `react-native-gesture-handler` LongPressGestureHandler
- When long-pressed, enable drag mode
- Use DraggableFlatList or manual position tracking
- Update order in Supabase when drag ends

### 5. Quick Add Implementation

- Input field always visible at bottom of each column
- Or: Tap empty space in column to show input (preferred)
- On focus: Input appears, keyboard shows
- On submit (Enter/Return): Create new item in current column
- Auto-focus and clear after adding

### 6. Data Flow

- Use Supabase real-time subscriptions (same as web app) for live updates
- Optimistic updates: Update UI immediately, sync to Supabase in background
- Handle offline: Queue updates, sync when online (basic version, can enhance later)

### 7. iOS Optimization

- Use iOS-native feel: System fonts (SF Pro), native navigation patterns
- Safe area handling: Use `react-native-safe-area-context`
- Haptic feedback: Use `expo-haptics` for swipe and drag actions
- Keyboard handling: Use `KeyboardAvoidingView` for input fields

### 8. Styling

- Simple, clean design matching web app aesthetic
- Use StyleSheet API (no CSS files)
- iOS-optimized colors and spacing
- Smooth animations for all interactions

## File Structure

```
mobile/
├── app.json
├── package.json
├── tsconfig.json
├── App.tsx (entry point)
├── src/
│   ├── services/
│   │   ├── supabaseClient.ts
│   │   └── database.ts
│   ├── auth/
│   │   └── AuthContext.tsx
│   ├── components/
│   │   ├── TodoItem.tsx
│   │   ├── TodoList.tsx
│   │   ├── ColumnView.tsx
│   │   ├── MainScreen.tsx
│   │   └── QuickAddInput.tsx
│   ├── hooks/
│   │   ├── useBoard.ts
│   │   ├── useSwipeToToggle.ts
│   │   └── useDragToReorder.ts
│   └── utils/
│       └── constants.ts
```

## Key Implementation Details

### Swipe to Toggle Logic

```typescript
// When swipe right detected on item in DO column:
// 1. Remove from DO items array
// 2. Add to DONE items array with completedAt = now
// 3. Update Supabase: UPDATE todos SET column_id = 'done', completed_at = now WHERE id = itemId

// When swipe right detected on item in DONE column:
// 1. Remove from DONE items array  
// 2. Add to DO items array, clear completedAt
// 3. Update Supabase: UPDATE todos SET column_id = 'do', completed_at = null WHERE id = itemId
```

### Drag to Reorder Logic

```typescript
// When item dragged and dropped:
// 1. Reorder items array locally (optimistic update)
// 2. Update Supabase: UPDATE todos SET position = newIndex WHERE id = itemId AND column_id = columnId
// 3. Batch update all affected items' positions
```

### Quick Add Logic

```typescript
// When user taps empty space or quick-add area:
// 1. Show TextInput, focus immediately
// 2. On submit: INSERT into Supabase todos table
// 3. Add to local state optimistically
// 4. Clear input, hide if was triggered by tap
```

## Testing Strategy

- Test on iOS simulator first
- Test swipe gestures with different swipe distances
- Test long-press drag with multiple items
- Test quick-add in both columns
- Test offline/online sync behavior
- Test authentication flow

## Future Enhancements (Out of Scope)

- Android optimization
- Other columns (IGNORE, OTHERS, EMBER)
- Search functionality
- Cut/copy/paste
- Keyboard shortcuts

## Estimated Effort

- Setup and configuration: 1 hour
- Core components: 4-6 hours
- Gesture implementation: 3-4 hours
- Data integration: 2-3 hours
- iOS polish: 2-3 hours
- Testing and fixes: 2-3 hours

**Total: ~14-20 hours**

### To-dos

- [ ] Initialize Expo project in mobile/ directory, configure app.json for iOS, install dependencies (react-native-gesture-handler, react-native-reanimated, async-storage, supabase-js)
- [ ] Create mobile/src/services/ with supabaseClient.ts and database.ts, adapt auth context for React Native
- [ ] Build TodoItem component with tap-to-edit, swipe-right gesture handler, and long-press drag handle
- [ ] Build TodoList component with DraggableFlatList for reordering, integrate swipe gestures
- [ ] Build ColumnView component that renders DO or DONE column with header, TodoList, and quick-add input
- [ ] Build MainScreen component with column toggle (DO/DONE), integrate authentication, handle real-time updates
- [ ] Implement useSwipeToToggle hook using react-native-gesture-handler to handle swipe-right for DO/DONE toggle
- [ ] Implement useDragToReorder hook for long-press drag functionality to reorder items within columns
- [ ] Implement quick-add input that appears on tap, auto-focuses, and creates items on submit
- [ ] Add iOS optimizations: safe area handling, haptic feedback, keyboard handling, native feel styling
- [ ] Test all interactions on iOS simulator: swipe gestures, drag-to-reorder, quick-add, authentication flow