# Do/Done Mobile App

iOS-only mobile app for the Do/Done todo board system. Built with Expo, React Native, and Supabase.

## Features

- **Authentication**: Email/password sign in and sign up
- **Do/Done Columns**: Segmented view to switch between Do and Done columns
- **Quick Add**: Add todos at the top of the current column
- **Swipe to Toggle**: Swipe right on a todo to move it between Do and Done
- **Long-Press Reorder**: Long-press and drag to reorder todos within a column
- **Tap to Edit**: Tap any todo to edit its text inline

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Expo Go app on your device

### Installation

1. Install dependencies:
```bash
cd mobile
npm install
```

2. Configure environment variables in `app.config.ts`:
   - Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the `extra` section
   - Optionally set `BOARD_SLUG` to target a specific board

   Or set them as environment variables:
```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-anon-key"
export BOARD_SLUG="your-board-slug"  # optional
```

3. Start the development server:
```bash
npm start
```

4. Run on iOS simulator:
```bash
npm run ios
```

Or scan the QR code with Expo Go on your device.

## Architecture

- **Thin UI Layer**: All business logic lives in Supabase; mobile app is a thin client
- **Single Source of Truth**: Uses the same Supabase tables and RLS policies as the web app
- **Minimal Dependencies**: Only essential packages for gestures, animations, and data fetching

## Project Structure

```
mobile/
├── app.config.ts          # Expo config with env vars
├── App.tsx                # Root app with navigation
└── src/
    ├── services/
    │   ├── supabase.ts    # Supabase client setup
    │   └── database.ts    # Thin database functions
    ├── screens/
    │   ├── AuthScreen.tsx # Email/password auth
    │   └── BoardScreen.tsx # Main board view
    ├── components/
    │   ├── TodoRow.tsx    # Individual todo with swipe/edit
    │   └── ReorderList.tsx # Draggable list wrapper
    └── utils/
        └── position.ts    # Position computation logic
```

## Notes

- No realtime subscriptions (manual refresh by reloading the app)
- No offline caching
- No multi-board UI (uses primary board only)
- Position logic uses 1000-step spacing to avoid frequent renormalization
