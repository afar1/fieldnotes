<!-- 24f4c8b3-d11e-43a6-9dbe-8f0094173cdc 700f2541-512e-45ca-bf6d-58e1267c231d -->
# Expo Board Mobile Plan

1. Confirm API contract: Read existing board/todo endpoints, note required auth headers, and verify one-board filter logic matches mobile needs. Summarize findings in `docs/mobile-api-notes.md`.
2. Bootstrap Expo app: Generate a bare Expo project in `mobile/`, configure iOS target, reuse existing env setup for API base URL, and wire simple navigation with a single Board screen.
3. Implement board screen data flow: Fetch the single board on mount, render To-Do and Done columns, and reuse present sorting/grouping rules so we do not break the current workflow.
4. Add core interactions: Inline quick-add input, tap-to-edit sheet mirroring web fields, swipe gesture to toggle status using the existing update endpoint, and long-press drag to reorder with optimistic updates and graceful fallback.
5. Polish and verify on iOS: Ensure touch targets, fonts, and spacing are comfortable, run on iOS simulator, and document manual QA steps plus any follow-up gaps in `docs/mobile-testing.md`.

### To-dos

- [ ] Review board/todo backend endpoints and document mobile subset
- [ ] Initialize Expo project with iOS config and navigation shell
- [ ] Implement board data fetch/render with quick add/edit gestures
- [ ] Run iOS simulator smoke tests and note results