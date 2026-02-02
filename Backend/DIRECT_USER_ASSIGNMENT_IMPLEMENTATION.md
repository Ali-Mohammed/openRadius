# Direct User Assignment for Billing Profiles - Implementation Summary

## Overview
This implementation adds support for direct user assignment to billing profiles, allowing profiles to be assigned either to:
1. **Billing Groups** (existing functionality)
2. **Direct Users** (new functionality)

## Database Changes

### New Table: BillingProfileUsers
Junction table to track direct user assignments to billing profiles.

**Migration File**: `add_billing_profile_users_table.sql`

```sql
CREATE TABLE "BillingProfileUsers" (
    "Id" SERIAL PRIMARY KEY,
    "BillingProfileId" INTEGER NOT NULL,
    "UserId" INTEGER NOT NULL,
    "AssignedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    "AssignedBy" INTEGER,
    CONSTRAINT FK_BillingProfileUsers_BillingProfiles FOREIGN KEY ...
    CONSTRAINT FK_BillingProfileUsers_Users_UserId FOREIGN KEY ...
    CONSTRAINT FK_BillingProfileUsers_Users_AssignedBy FOREIGN KEY ...
);
```

**Indexes**:
- Unique index on (BillingProfileId, UserId) to prevent duplicates
- Index on BillingProfileId for faster lookups
- Index on UserId for faster lookups

## Backend Changes

### 1. Models (`Backend/Models/Billing/BillingProfile.cs`)

**Added New Model**:
```csharp
public class BillingProfileUser
{
    public int Id { get; set; }
    public int BillingProfileId { get; set; }
    public int UserId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public int? AssignedBy { get; set; }
    
    public virtual BillingProfile BillingProfile { get; set; } = null!;
    public virtual User User { get; set; } = null!;
    public virtual User? AssignedByUser { get; set; }
}
```

**Updated BillingProfile Model**:
- Added navigation property: `ICollection<BillingProfileUser> ProfileUsers`

### 2. Database Context (`Backend/Data/ApplicationDbContext.cs`)

**Added DbSet**:
```csharp
public DbSet<BillingProfileUser> BillingProfileUsers { get; set; }
```

**Added Entity Configuration**:
```csharp
modelBuilder.Entity<BillingProfileUser>(entity =>
{
    entity.HasKey(e => e.Id);
    entity.HasIndex(e => new { e.BillingProfileId, e.UserId }).IsUnique();
    // ... relationships and cascading deletes
});
```

### 3. DTOs (`Backend/Controllers/Billing/BillingProfileController.cs`)

**Updated Request DTOs**:
```csharp
public class CreateBillingProfileRequest
{
    // ... existing properties
    public List<int>? UserIds { get; set; } // NEW: Direct user assignment
}

public class UpdateBillingProfileRequest
{
    // ... existing properties
    public List<int>? UserIds { get; set; } // NEW: Direct user assignment
}
```

### 4. Controller Methods

**CreateProfile** - Now handles UserIds:
```csharp
// Add direct user assignments
if (request.UserIds != null && request.UserIds.Any())
{
    var profileUsers = request.UserIds.Select(userId => new BillingProfileUser
    {
        BillingProfileId = profile.Id,
        UserId = userId,
        AssignedAt = DateTime.UtcNow,
        AssignedBy = User.GetSystemUserId()
    }).ToList();
    
    _context.BillingProfileUsers.AddRange(profileUsers);
}
```

**UpdateProfile** - Now handles UserIds:
```csharp
// Update direct user assignments - remove old ones and add new ones
_context.BillingProfileUsers.RemoveRange(existingProfile.ProfileUsers);

if (request.UserIds != null && request.UserIds.Any())
{
    var profileUsers = request.UserIds.Select(userId => new BillingProfileUser
    {
        BillingProfileId = existingProfile.Id,
        UserId = userId,
        AssignedAt = DateTime.UtcNow,
        AssignedBy = User.GetSystemUserId()
    }).ToList();
    
    _context.BillingProfileUsers.AddRange(profileUsers);
}
```

**GetProfiles & GetProfile** - Now return UserIds:
```csharp
.Select(p => new
{
    // ... existing properties
    UserIds = p.ProfileUsers.Select(pu => pu.UserId).ToList(), // NEW
    // ... other properties
})
```

## Frontend Changes

### 1. TypeScript Interfaces (`Frontend/src/api/billingProfiles.ts`)

**Updated Interfaces**:
```typescript
export interface BillingProfile {
    // ... existing properties
    userIds?: number[]; // NEW: Direct user assignments
}

export interface CreateBillingProfileRequest {
    // ... existing properties
    userIds?: number[]; // NEW: Direct user assignments
}

export interface UpdateBillingProfileRequest {
    // ... existing properties
    userIds?: number[]; // NEW: Direct user assignments
}
```

### 2. Form Component (`Frontend/src/pages/billing/BillingProfileForm.tsx`)

**New State Variables**:
```typescript
const [assignmentMode, setAssignmentMode] = useState<'groups' | 'users'>('groups');
const [selectedDirectUsers, setSelectedDirectUsers] = useState<number[]>([]);
const [userPopoverOpen, setUserPopoverOpen] = useState(false);
const [userSearch, setUserSearch] = useState('');
```

**New Imports**:
- `Search`, `Users` from lucide-react
- `Checkbox`, `Badge` from UI components
- `Tabs`, `TabsList`, `TabsTrigger` from UI components
- `userManagementApi` for fetching users

**Assignment Mode Toggle**:
```tsx
<Tabs value={assignmentMode} onValueChange={(value: any) => {
    setAssignmentMode(value);
    if (value === 'groups') {
        setSelectedDirectUsers([]);
    } else {
        setSelectedBillingGroups([]);
        setSelectAllGroups(false);
    }
}}>
    <TabsList>
        <TabsTrigger value="groups">Groups</TabsTrigger>
        <TabsTrigger value="users">Direct Users</TabsTrigger>
    </TabsList>
</Tabs>
```

**Direct User Selection UI**:
- Popover with searchable user list
- Checkboxes for multi-select
- Selected users displayed as removable badges

**Form Submission**:
```typescript
const submitData: CreateBillingProfileRequest = {
    ...formData,
    radiusProfileId: selectedRadiusProfiles[0]?.profileId || 0,
    billingGroupId: assignmentMode === 'groups' ? (selectAllGroups ? 0 : selectedBillingGroups[0] || 0) : 0,
    userIds: assignmentMode === 'users' ? selectedDirectUsers : undefined, // NEW
    // ... other fields
};
```

**Loading Existing Profile**:
```typescript
useEffect(() => {
    if (existingProfile) {
        // Check if this profile has direct user assignments
        if (existingProfile.userIds && existingProfile.userIds.length > 0) {
            setAssignmentMode('users');
            setSelectedDirectUsers(existingProfile.userIds);
            setSelectedBillingGroups([]);
            setSelectAllGroups(false);
        } else {
            // Handle groups mode
            const isAllGroups = existingProfile.billingGroupId === 0 || existingProfile.billingGroupId === null;
            setAssignmentMode('groups');
            setSelectAllGroups(isAllGroups);
            setSelectedBillingGroups(isAllGroups ? [] : [existingProfile.billingGroupId]);
            setSelectedDirectUsers([]);
        }
    }
}, [existingProfile]);
```

## Usage Flow

### Creating a Profile with Direct Users:
1. User navigates to Create Billing Profile form
2. User switches to "Direct Users" tab in Assignment section
3. User clicks "Select users" button
4. User searches and selects users via checkboxes
5. Selected users appear as badges below
6. On submit, `userIds` array is sent to backend
7. Backend creates BillingProfileUser records

### Updating a Profile:
1. Existing profile loads with correct assignment mode
2. If userIds exist, "Direct Users" tab is selected automatically
3. User can switch between modes (clears the other selection)
4. On submit, old assignments are removed and new ones are created

### Backend Processing:
1. Receives userIds in request
2. Validates user existence (FK constraint handles this)
3. Creates/updates BillingProfileUser records
4. Returns profile with userIds in response

## Migration Instructions

1. **Apply Database Migration**:
   ```bash
   psql -U your_user -d your_database -f add_billing_profile_users_table.sql
   ```

2. **Restart Backend**:
   - The new model and DbSet will be recognized
   - EF Core will include ProfileUsers in queries

3. **Frontend**:
   - No build changes needed
   - TypeScript interfaces are already updated

## Benefits

1. **Flexibility**: Profiles can now target specific users without requiring group creation
2. **Granular Control**: Assign profiles to individual users for special cases
3. **Backward Compatible**: Existing group-based assignments continue to work
4. **Clean Architecture**: Junction table follows database normalization principles
5. **Audit Trail**: Tracks who assigned users and when

## Testing Checklist

- [ ] Create profile with direct users
- [ ] Update profile from groups to direct users
- [ ] Update profile from direct users to groups
- [ ] Edit existing profile with direct users
- [ ] Delete profile (should cascade delete assignments)
- [ ] Validate unique constraint (prevent duplicate assignments)
- [ ] Test with multiple users selected
- [ ] Test search functionality in user selector
- [ ] Verify assignment tracking (AssignedAt, AssignedBy)

## Future Enhancements

1. Allow combination of groups AND direct users
2. Add bulk user assignment operations
3. Show assignment history
4. Add user removal/addition without full profile edit
