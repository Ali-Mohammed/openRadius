# UUID Display Implementation Plan

## Overview
Update frontend to display UUIDs for enterprise/user-facing purposes while keeping int IDs for internal API operations.

## Strategy
1. **Display Layer**: Show UUID to users in tables, detail pages, exports
2. **Internal Layer**: Use int ID for API calls, routing, internal logic
3. **Copy Functionality**: Copy UUID instead of ID
4. **Export/Reports**: Include UUID in exported data

## Key Areas to Update

### 1. Table Displays (Add UUID Column)
- BillingProfiles.tsx
- RadiusUsers.tsx
- BillingActivations.tsx
- Transactions.tsx
- RadiusCustomAttributes.tsx
- UserWallets.tsx
- All other entity tables

### 2. Detail/View Pages
- Show UUID prominently with copy button
- Keep ID hidden or for internal use only

### 3. Export Functionality
- Include UUID field in CSV exports
- Use UUID as primary identifier in reports

### 4. Copy Actions
- Change "Copy ID" to "Copy UUID"
- Copy UUID value instead of int ID

## Implementation Example

### Before (Internal ID):
```tsx
<TableCell>{profile.id}</TableCell>
<Button onClick={() => navigator.clipboard.writeText(profile.id.toString())}>
  Copy ID
</Button>
```

### After (Enterprise UUID):
```tsx
<TableCell>
  <code className="text-xs">{profile.uuid}</code>
</TableCell>
<Button onClick={() => navigator.clipboard.writeText(profile.uuid)}>
  <Copy className="h-4 w-4" />
</Button>
```

## Benefits
- ✅ Enterprise-grade external identifiers
- ✅ Better security (UUIDs don't reveal counts)
- ✅ Cross-system compatibility
- ✅ Follows industry standards (Stripe, GitHub, AWS)
- ✅ No breaking changes (IDs still work internally)
