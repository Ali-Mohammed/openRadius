# Soft Delete Implementation Guide

## Overview

OpenRadius implements a **soft delete pattern** across all major entities, providing a safe, recoverable deletion system with trash management and restore capabilities.

## What is Soft Delete?

Soft delete is a data management pattern where records are **marked as deleted** instead of being permanently removed from the database. This provides:

- ✅ **Data Recovery** - Deleted items can be restored
- ✅ **Audit Trail** - Track when items were deleted
- ✅ **Safety** - Prevent accidental permanent data loss
- ✅ **Compliance** - Meet data retention requirements
- ✅ **User Experience** - Trash/recycle bin functionality

## Architecture

### Database Schema

All soft-deletable entities have two additional properties:

```csharp
public bool IsDeleted { get; set; }              // Default: false
public DateTime? DeletedAt { get; set; }          // Null when active
```

### Entities Supporting Soft Delete

| Entity | Database | Description |
|--------|----------|-------------|
| **RadiusUser** | Workspace | RADIUS authentication users |
| **RadiusProfile** | Workspace | RADIUS user profiles/plans |
| **SasRadiusIntegration** | Workspace | External RADIUS server integrations |
| **OidcSettings** | Master | OIDC authentication provider configurations |

## Backend Implementation

### Database Migrations

**Workspace Databases** (ApplicationDbContext):
```powershell
# Migration: AddSoftDeleteToEntities
dotnet ef migrations add AddSoftDeleteToEntities --context ApplicationDbContext

# Apply to workspace_1
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=openradius_workspace_1;Username=admin;Password=admin123"
dotnet ef database update --context ApplicationDbContext

# Apply to workspace_2
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=openradius_workspace_2;Username=admin;Password=admin123"
dotnet ef database update --context ApplicationDbContext
```

**Master Database** (MasterDbContext):
```powershell
# Migration: AddSoftDeleteToOidcSettings
dotnet ef migrations add AddSoftDeleteToOidcSettings --context MasterDbContext
dotnet ef database update --context MasterDbContext
```

### Controller Endpoints

Each entity has three soft delete endpoints:

#### 1. Delete (Soft Delete)
```http
DELETE /api/{entity}/{id}
```

**Example**: DELETE `/api/RadiusUser/123`

**Implementation**:
```csharp
[HttpDelete("{id}")]
public async Task<IActionResult> DeleteUser(int id)
{
    var user = await _context.RadiusUsers.FindAsync(id);
    if (user == null) return NotFound();
    
    // Soft delete
    user.IsDeleted = true;
    user.DeletedAt = DateTime.UtcNow;
    
    await _context.SaveChangesAsync();
    return NoContent();
}
```

#### 2. Restore
```http
POST /api/{entity}/{id}/restore
```

**Example**: POST `/api/RadiusUser/123/restore`

**Implementation**:
```csharp
[HttpPost("{id}/restore")]
public async Task<IActionResult> RestoreUser(int id)
{
    var user = await _context.RadiusUsers
        .IgnoreQueryFilters()
        .FirstOrDefaultAsync(u => u.Id == id && u.IsDeleted);
        
    if (user == null) return NotFound();
    
    user.IsDeleted = false;
    user.DeletedAt = null;
    
    await _context.SaveChangesAsync();
    return Ok();
}
```

#### 3. Get Trash
```http
GET /api/{entity}/trash?page=1&pageSize=50
```

**Example**: GET `/api/RadiusUser/trash?page=1&pageSize=50`

**Implementation**:
```csharp
[HttpGet("trash")]
public async Task<ActionResult<PaginatedResponse<RadiusUserResponse>>> GetDeletedUsers(
    [FromQuery] int page = 1, 
    [FromQuery] int pageSize = 50)
{
    var query = _context.RadiusUsers
        .IgnoreQueryFilters()
        .Where(u => u.IsDeleted)
        .OrderByDescending(u => u.DeletedAt);
        
    var totalItems = await query.CountAsync();
    var users = await query
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();
        
    return Ok(new PaginatedResponse<RadiusUserResponse>
    {
        Data = users.Select(MapToResponse).ToList(),
        Pagination = new PaginationInfo
        {
            CurrentPage = page,
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
        }
    });
}
```

### Query Filtering

All GET endpoints automatically filter out deleted items:

```csharp
[HttpGet]
public async Task<ActionResult<IEnumerable<RadiusUser>>> GetUsers(
    [FromQuery] bool includeDeleted = false)
{
    var query = _context.RadiusUsers.AsQueryable();
    
    if (!includeDeleted)
    {
        query = query.Where(u => !u.IsDeleted);
    }
    
    return await query.ToListAsync();
}
```

### Special Protection Rules

**Default OIDC Provider Cannot Be Deleted**:
```csharp
[HttpDelete("{id}")]
public async Task<IActionResult> DeleteSettings(int id)
{
    var settings = await _context.OidcSettings.FindAsync(id);
    if (settings == null) return NotFound();
    
    // Protect default provider
    if (settings.IsDefault)
    {
        return BadRequest("Cannot delete the default OIDC provider");
    }
    
    settings.IsDeleted = true;
    settings.DeletedAt = DateTime.UtcNow;
    
    await _context.SaveChangesAsync();
    return NoContent();
}
```

## Frontend Implementation

### API Layer

Each API client includes restore and trash methods:

**Example** - `radiusUserApi.ts`:
```typescript
export const radiusUserApi = {
  // ... other methods
  
  delete: async (workspaceId: number, id: number) => {
    await apiClient.delete(`/api/workspaces/${workspaceId}/RadiusUser/${id}`)
  },
  
  restore: async (workspaceId: number, id: number) => {
    await apiClient.post(`/api/workspaces/${workspaceId}/RadiusUser/${id}/restore`)
  },
  
  getTrash: async (workspaceId: number, page: number, pageSize: number) => {
    const { data } = await apiClient.get(
      `/api/workspaces/${workspaceId}/RadiusUser/trash`,
      { params: { page, pageSize } }
    )
    return data
  },
}
```

### UI Components

Each page implements:

#### 1. State Management
```typescript
const [showTrash, setShowTrash] = useState(false)
const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
const [itemToRestore, setItemToRestore] = useState<number | null>(null)
```

#### 2. Toggle Button
```tsx
<Button
  onClick={() => setShowTrash(!showTrash)}
  variant={showTrash ? 'default' : 'outline'}
>
  <Archive className="mr-2 h-4 w-4" />
  {showTrash ? 'Show Active' : 'Show Trash'}
</Button>
```

#### 3. Conditional Query
```typescript
const { data: usersData } = useQuery({
  queryKey: ['radius-users', workspaceId, page, pageSize, showTrash],
  queryFn: () => showTrash 
    ? radiusUserApi.getTrash(workspaceId, page, pageSize)
    : radiusUserApi.getAll(workspaceId, page, pageSize),
})
```

#### 4. Conditional Actions
```tsx
<TableCell className="text-right">
  {showTrash ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleRestore(item.id)}
      title="Restore item"
    >
      <RotateCcw className="h-4 w-4 text-green-600" />
    </Button>
  ) : (
    <>
      <Button onClick={() => handleEdit(item)}>
        <Edit className="h-4 w-4" />
      </Button>
      <Button onClick={() => handleDelete(item)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  )}
</TableCell>
```

#### 5. Restore Mutation
```typescript
const restoreMutation = useMutation({
  mutationFn: (id: number) => radiusUserApi.restore(workspaceId, id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['radius-users', workspaceId] })
    toast.success('User restored successfully')
  },
})
```

#### 6. Confirmation Dialogs
```tsx
{/* Delete Confirmation */}
<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This will move the item to trash. You can restore it later from the trash view.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

{/* Restore Confirmation */}
<AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Restore Item?</AlertDialogTitle>
      <AlertDialogDescription>
        This will restore the item and make it available again.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmRestore}>Restore</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## User Experience

### Workflow

1. **Normal View** - User sees only active items
2. **Click "Show Trash"** - Toggle to trash view
3. **Trash View** - User sees only deleted items with restore buttons
4. **Click Restore Icon** - Confirmation dialog appears
5. **Confirm Restore** - Item restored and moved back to active view
6. **Click "Show Active"** - Return to normal view

### Visual Indicators

- **Archive Button**: Switches between outline (active) and default (trash) variants
- **Restore Icon**: Green RotateCcw icon (↻) for restore action
- **Conditional UI**: Add/Edit/Sync buttons hidden in trash view
- **Toast Notifications**: Success/error feedback for all actions

## API Reference

### RadiusUser Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces/{id}/RadiusUser` | Get active users |
| GET | `/api/workspaces/{id}/RadiusUser/trash` | Get deleted users |
| DELETE | `/api/workspaces/{id}/RadiusUser/{id}` | Soft delete user |
| POST | `/api/workspaces/{id}/RadiusUser/{id}/restore` | Restore user |

### RadiusProfile Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces/{id}/RadiusProfile` | Get active profiles |
| GET | `/api/workspaces/{id}/RadiusProfile/trash` | Get deleted profiles |
| DELETE | `/api/workspaces/{id}/RadiusProfile/{id}` | Soft delete profile |
| POST | `/api/workspaces/{id}/RadiusProfile/{id}/restore` | Restore profile |

### SasRadiusIntegration Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces/{id}/SasRadiusIntegration` | Get active integrations |
| GET | `/api/workspaces/{id}/SasRadiusIntegration/trash` | Get deleted integrations |
| DELETE | `/api/workspaces/{id}/SasRadiusIntegration/{id}` | Soft delete integration |
| POST | `/api/workspaces/{id}/SasRadiusIntegration/{id}/restore` | Restore integration |

### OidcSettings Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/oidcsettings` | Get active OIDC providers |
| GET | `/api/oidcsettings/trash` | Get deleted OIDC providers |
| DELETE | `/api/oidcsettings/{id}` | Soft delete provider (not default) |
| POST | `/api/oidcsettings/{id}/restore` | Restore provider |

## Testing

### Backend Testing

**Test Soft Delete**:
```bash
curl -X DELETE http://localhost:5000/api/RadiusUser/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Get Trash**:
```bash
curl http://localhost:5000/api/RadiusUser/trash?page=1&pageSize=50 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Restore**:
```bash
curl -X POST http://localhost:5000/api/RadiusUser/1/restore \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Verification

**Check deleted items**:
```sql
SELECT "Id", "Username", "IsDeleted", "DeletedAt" 
FROM "RadiusUsers" 
WHERE "IsDeleted" = true;
```

**Check active items**:
```sql
SELECT "Id", "Username", "IsDeleted", "DeletedAt" 
FROM "RadiusUsers" 
WHERE "IsDeleted" = false OR "IsDeleted" IS NULL;
```

## Best Practices

### Development
- ✅ Always use soft delete for user-facing entities
- ✅ Test both delete and restore flows
- ✅ Verify query filters exclude deleted items
- ✅ Include deletion metadata (DeletedAt timestamp)
- ✅ Provide clear UI indicators for trash view

### Production
- ✅ Consider periodic cleanup of old deleted items
- ✅ Monitor trash item counts
- ✅ Implement permanent delete for admins (optional)
- ✅ Log all restore operations for audit trail
- ✅ Set retention policies for deleted items

## Troubleshooting

### Items Still Appearing After Delete
- Check if `IsDeleted` flag is being set correctly
- Verify query includes `.Where(x => !x.IsDeleted)` filter
- Check database migration was applied

### Restore Not Working
- Ensure using `IgnoreQueryFilters()` in restore query
- Check if item exists and has `IsDeleted = true`
- Verify restore endpoint is being called correctly

### Default OIDC Provider Deletion
- This is **by design** - default provider cannot be deleted
- Change default to another provider first
- Then delete the previous default

## Future Enhancements

Potential improvements:
- [ ] Permanent delete for administrators
- [ ] Automatic cleanup of old deleted items (30/60/90 days)
- [ ] Bulk restore operations
- [ ] Restore history/audit log
- [ ] Deleted item search functionality
- [ ] Export deleted items before permanent deletion

## Summary

The soft delete implementation provides:
- ✅ **Safety** - No accidental permanent data loss
- ✅ **Recovery** - Easy restoration of deleted items
- ✅ **User Experience** - Familiar trash/recycle bin pattern
- ✅ **Audit Trail** - Track when items were deleted
- ✅ **Compliance** - Meet data retention requirements
- ✅ **Flexibility** - Can be extended to permanent delete if needed
