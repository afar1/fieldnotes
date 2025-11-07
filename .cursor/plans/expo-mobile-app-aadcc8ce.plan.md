<!-- aadcc8ce-b088-451b-815b-2661a0dd9028 7c6adc57-b802-489b-abe9-4e114d0bfd79 -->
# Expo Mobile App for Todo List

## Overview

Build a mobile-first iOS app using Expo that connects to the existing Supabase backend, focusing on DO/DONE columns with touch-optimized interactions.

## Project Structure

- Create new Expo project in `todo-drag/mobile/`
- Share Supabase backend with web app
- Use same authentication and data models

## Core Features (v1)

1. **DO/DONE columns only** - simplified two-column view
2. **Swipe right** - toggle item between DO ↔ DONE
3. **Long-press** - grab and reorder items within column
4. **Tap** - edit item text inline
5. **Quick-add** - tap input to immediately start typing

## Implementation Steps

### 1. Initialize Expo Project

Create new Expo app with TypeScript in `todo-drag/mobile/`:

```bash
cd todo-drag
npx create-expo-app mobile --template expo-template-blank-typescript
```

Install dependencies:

- `@supabase/supabase-js` - backend client
- `react-native-gesture-handler` - touch interactions
- `react-native-reanimated` - smooth animations
- `@react-native-async-storage/async-storage` - local persistence

### 2. Supabase Integration

Copy Supabase configuration from web app:

- Create `mobile/src/lib/supabase.ts` - initialize client with same URL/keys
- Create `mobile/src/contexts/AuthContext.tsx` - auth state management
- Create `mobile/src/types/database.ts` - TypeScript types for boards, columns, todos

Key consideration: Use same environment variables as web app (REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY) for consistency.

### 3. Authentication Flow

Build simple auth screens:

- `mobile/src/screens/LoginScreen.tsx` - email/password login
- `mobile/src/screens/BoardScreen.tsx` - main todo interface
- Use Supabase auth with auto-session management
- Protect BoardScreen with auth check

### 4. Data Layer

Create hooks for data fetching:

- `mobile/src/hooks/useBoard.ts` - fetch user's first board
- `mobile/src/hooks/useColumns.ts` - fetch DO/DONE columns
- `mobile/src/hooks/useTodos.ts` - fetch items per column with real-time updates

Sync strategy:

- Use Supabase real-time subscriptions for live updates
- Cache data locally with AsyncStorage for offline viewing
- Optimistic updates for instant UI feedback

### 5. UI Components

**Column Component** (`mobile/src/components/Column.tsx`):

- Vertical list with FlatList for performance
- Header with column name and item count
- Quick-add input at top (always visible)

**TodoItem Component** (`mobile/src/components/TodoItem.tsx`):

- Text display with tap-to-edit inline
- Background card with rounded corners
- Visual feedback on press/swipe

**SwipeableItem** (wrap TodoItem):

- Use `react-native-gesture-handler` Swipeable
- Swipe right gesture → move to opposite column
- Animate item removal and appearance in new column
- Haptic feedback on successful swipe

**DraggableList** (for reordering):

- Long-press to activate drag mode
- Use `react-native-reanimated` for smooth reordering
- Visual elevation when item is grabbed
- Drop zones with subtle indicators

### 6. Gesture Interactions

**Swipe Right Gesture**:

```typescript
// On swipe right completion:
// - If item in DO → move to DONE (set completedAt timestamp)
// - If item in DONE → move to DO (clear completedAt)
// - Optimistic update + Supabase sync
// - Animate item exit and entry
```

**Long Press + Drag**:

```typescript
// On long press (500ms):
// - Activate drag mode with haptic feedback
// - Lift item visually (scale + shadow)
// - Track vertical drag position
// - Update item position on drop
// - Sync new order to Supabase
```

**Tap to Edit**:

```typescript
// On tap:
// - Show TextInput inline
// - Auto-focus with keyboard
// - Save on blur or Enter key
// - Cancel on Escape (via keyboard dismiss)
```

### 7. Quick Add Functionality

- Input field always visible at top of each column
- Placeholder: "Add to DO..." / "Add to DONE..."
- Auto-focus when tapping
- Press Return to add item and clear input
- Item appears at top of list with animation
- Immediately syncs to Supabase

### 8. Styling (iOS-focused)

- Use iOS native-feeling components
- Safe area handling for notch/home indicator
- System fonts (SF Pro)
- Light/dark mode support using system theme
- Subtle shadows and animations
- Haptic feedback for all interactions

### 9. Error Handling & Offline Support

- Show connection status indicator
- Queue operations when offline
- Retry failed syncs when connection restored
- Error boundaries for crashes
- Toast notifications for user feedback

### 10. Testing & Polish

- Test on actual iOS device (not just simulator)
- Verify gesture thresholds feel natural
- Ensure animations are smooth (60fps)
- Test with large lists (100+ items)
- Verify real-time sync across web and mobile

## Files to Create

```
todo-drag/mobile/
├── app.json
├── package.json
├── tsconfig.json
├── App.tsx
├── src/
│   ├── lib/
│   │   └── supabase.ts          # Supabase client
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state
│   ├── screens/
│   │   ├── LoginScreen.tsx      # Auth screen
│   │   └── BoardScreen.tsx      # Main todo interface
│   ├── components/
│   │   ├── Column.tsx           # Column container
│   │   ├── TodoItem.tsx         # Single todo item
│   │   ├── SwipeableItem.tsx    # Swipeable wrapper
│   │   └── QuickAdd.tsx         # Quick add input
│   ├── hooks/
│   │   ├── useBoard.ts          # Board data
│   │   ├── useColumns.ts        # Column data
│   │   └── useTodos.ts          # Todo items + mutations
│   └── types/
│       └── database.ts          # Supabase types
```

## Key Technical Decisions

1. **Expo vs React Native CLI**: Using Expo for faster development and built-in iOS optimizations
2. **No drag-drop library**: Build custom gestures with `react-native-gesture-handler` for better touch control
3. **Real-time first**: Supabase subscriptions ensure immediate sync across devices
4. **Optimistic updates**: Update UI immediately, sync in background for responsive feel
5. **Simple state**: Use React hooks + context, no Redux needed for v1

## Excluded from v1

- IGNORE/OTHERS columns
- Multi-select items
- Search functionality
- Column toggles
- Keyboard shortcuts
- Desktop/tablet layouts
- Batch operations
- Tags/metadata

## Future Enhancements (v2+)

- All columns with horizontal swipe between them
- Pull-to-refresh
- Haptic patterns for different actions
- Siri shortcuts integration
- Widget support
- Share extension (add items from other apps)

### To-dos

- [ ] Initialize Expo project with TypeScript and install core dependencies (supabase, gesture-handler, reanimated, async-storage)
- [ ] Set up Supabase client and auth context using existing backend configuration
- [ ] Build login screen with email/password authentication
- [ ] Create hooks for fetching boards, columns, and todos with real-time subscriptions
- [ ] Build Column and TodoItem components with basic tap-to-edit functionality
- [ ] Implement swipe-right gesture to toggle items between DO and DONE columns
- [ ] Add long-press and drag to reorder items within a column
- [ ] Implement quick-add input at top of each column with instant focus
- [ ] Add iOS-specific styling, haptic feedback, safe areas, and animations
- [ ] Implement offline queueing and error handling with connection status