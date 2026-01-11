# Table Preferences System - Implementation Summary

## Overview
Implemented a complete system to automatically save and restore user table preferences (column widths, column order, column visibility, and sorting) across sessions.

## Backend Implementation

### 1. Model: `TablePreference.cs`
- Stores user preferences per table per workspace
- Fields: UserId, WorkspaceId, TableName, ColumnWidths (JSON), ColumnOrder (JSON), ColumnVisibility (JSON), SortField, SortDirection
- Unique constraint on: UserId + WorkspaceId + TableName

### 2. Database
- Added to `MasterDbContext.cs`
- Migration created and applied: `AddTablePreferences`
- Table: `TablePreferences` with unique index

### 3. Controller: `TablePreferenceController.cs`
- `GET /api/table-preferences/{tableName}?workspaceId={id}` - Get preferences
- `POST /api/table-preferences` - Save/update preferences
- `DELETE /api/table-preferences/{tableName}?workspaceId={id}` - Delete preferences
- Uses Keycloak user ID from JWT claims

## Frontend Implementation

### 1. API Client: `tablePreferenceApi.ts`
- `getPreference(tableName, workspaceId)` - Returns null if not found
- `savePreference(data)` - Creates or updates preferences
- `deletePreference(tableName, workspaceId)` - Removes preferences

### 2. RadiusUsers.tsx Integration
- **Load on mount**: Fetches saved preferences and applies them to state
- **Auto-save**: Debounced (1 second) automatic saving when preferences change
- **No user interruption**: All operations are silent (no toasts/errors shown to user)

## Features

### What Gets Saved:
- ✅ Column widths
- ✅ Column order (drag & drop positions)
- ✅ Column visibility toggles
- ✅ Sort field and direction

### How It Works:
1. User opens the radius users table
2. System loads their saved preferences (if any)
3. User changes column width, reorders columns, hides/shows columns, or sorts
4. After 1 second of inactivity, preferences are automatically saved
5. Next time user opens the table, all settings are restored

## Reusability
The system is designed to be reusable for any table in the application:
- Just call `tablePreferenceApi` with different table names
- Add the same useEffect hooks to other table components
- Each table's preferences are stored separately per user per workspace

## Database Migration
```bash
dotnet ef migrations add AddTablePreferences --context MasterDbContext
dotnet ef database update --context MasterDbContext
```

## Testing
✅ Backend compiles successfully
✅ Migration applied successfully
✅ Frontend TypeScript compiles (no critical errors)
✅ API endpoints ready to use

## Future Enhancements
- Add a "Reset to Default" button
- Export/import preferences
- Share preferences with team members
- Admin ability to set default preferences for all users
