# Fieldnotes PRD - Database & Authentication Implementation

## Overview
This document outlines the implementation plan for adding a robust front-end database and Google Authentication to the Fieldnotes application.

## Current State
- React-based todo application
- Local storage for data persistence
- Redux for state management
- Vercel deployment
- Version control system for data migrations

## Database Implementation Plan

### Requirements
1. Persistent storage beyond localStorage
2. Offline-first capabilities
3. Simple testing and deployment
4. Vercel-compatible
5. Efficient data syncing
6. Minimal configuration

### Selected Solution: Supabase (PostgreSQL)
The application uses Supabase as the backend database and authentication provider:
1. PostgreSQL database with Row Level Security (RLS)
2. Built-in authentication (email/password)
3. Real-time subscriptions for live updates
4. RESTful API for data operations
5. Secure user data isolation via RLS policies

**Note:** An earlier IndexedDB/Dexie.js implementation was removed in favor of Supabase. See git tag `indexeddb-last` for historical reference.

### Database Schema
The database schema is managed in Supabase with the following tables:
- `boards`: User boards (one per user by default)
- `board_columns`: Columns within boards (do, done, ignore, others, ember)
- `todos`: Todo items linked to columns and boards
- All tables use `owner_id` for Row Level Security (RLS) to ensure user data isolation

### Implementation Status
The Supabase implementation is complete and includes:
- Email/password authentication via Supabase Auth
- Row Level Security (RLS) policies for data isolation
- Real-time subscriptions for live updates (optional)
- RESTful API integration for CRUD operations
- Protected routes with React Router

## Authentication Implementation Plan

### Requirements
1. Google OAuth 2.0 integration
2. Secure user data isolation
3. Persistent auth state
4. Protected routes
5. Minimal user friction

### Selected Solution: Supabase Auth
The application uses Supabase Auth for authentication:
1. Email/password authentication
2. Password reset flow
3. Secure session management
4. Integrated with Supabase database
5. Row Level Security (RLS) for data isolation

### Authentication Flow
1. User navigates to login page
2. Enters email and password (or uses password reset)
3. Supabase Auth validates credentials
4. Session created and stored
5. User data loaded from Supabase database
6. Protected routes accessible

### Implementation Status
Authentication is fully implemented:
- Email/password authentication
- Password reset flow
- Protected routes with React Router
- Session management via Supabase Auth
- User data isolation via RLS policies

## Technical Architecture

### Database Layer
The application uses Supabase client (`@supabase/supabase-js`) for all database operations:
- Direct queries to PostgreSQL tables
- Real-time subscriptions for live updates
- Automatic RLS enforcement for data security

### Auth Integration
Authentication is handled via Supabase Auth:
- `supabase.auth.signInWithPassword()` for login
- `supabase.auth.signOut()` for logout
- `supabase.auth.resetPasswordForEmail()` for password reset
- Session management via `supabase.auth.getSession()`

## Implementation Status

The Supabase-based implementation is complete and deployed:
- Database schema and RLS policies configured
- Authentication flow implemented
- Protected routes working
- Real-time subscriptions available (optional)
- Production deployment on Vercel (`field-alpha.vercel.app`)

## Success Metrics
1. Zero data loss during migration
2. Sub-100ms query performance
3. 100% offline functionality
4. Zero auth-related security issues
5. Successful multi-device sync

## Testing Strategy
1. Unit tests for database operations
2. Integration tests for auth flow
3. E2E tests for critical paths
4. Performance benchmarks
5. Security audits

## Rollback Plan
1. Maintain localStorage backup
2. Version control for schema changes
3. Automated backup system
4. Feature flags for gradual rollout

## Future Considerations
1. Multi-device sync optimization
2. Real-time collaboration features
3. Enhanced offline capabilities
4. Additional auth providers
5. Advanced data analytics

## Dependencies
1. @supabase/supabase-js: ^2.74.0
2. react-router-dom: ^6.26.2
3. react-beautiful-dnd: 13.1.1

## Environment Variables
```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
``` 