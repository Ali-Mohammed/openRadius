# Radius Custom Attributes

## Overview

The Radius Custom Attributes feature allows you to define custom RADIUS attributes that can be linked to either **Radius Users** or **Radius Profiles**. This provides flexibility in managing RADIUS responses and check attributes for different scenarios.

## Features

- ✅ **Dual Link Types**: Link attributes to either users or profiles
- ✅ **Full CRUD Operations**: Create, Read, Update, Delete custom attributes
- ✅ **Attribute Types**: Support for both Reply (0) and Check (1) attributes
- ✅ **Operator Support**: Multiple RADIUS operators (:=, =, ==, +=)
- ✅ **Priority Management**: Control the order of attributes
- ✅ **Enable/Disable**: Toggle attributes without deletion
- ✅ **Soft Delete**: Deleted attributes can be restored
- ✅ **Search & Filter**: Find attributes by name, value, or link type
- ✅ **Bulk Operations**: Delete multiple attributes at once

## Database Schema

```sql
CREATE TABLE "RadiusCustomAttributes" (
    "Id" SERIAL PRIMARY KEY,
    "AttributeName" VARCHAR NOT NULL,
    "AttributeValue" VARCHAR NOT NULL,
    "AttributeType" INT NOT NULL DEFAULT 0,
    "Operator" VARCHAR NOT NULL DEFAULT ':=',
    "LinkType" VARCHAR NOT NULL,
    "RadiusUserId" INT NULL,
    "RadiusProfileId" INT NULL,
    "Priority" INT NOT NULL DEFAULT 0,
    "Enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "WorkspaceId" INT NOT NULL,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "DeletedAt" TIMESTAMP NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "FK_RadiusCustomAttributes_RadiusUsers" 
        FOREIGN KEY ("RadiusUserId") REFERENCES "RadiusUsers" ("Id"),
    CONSTRAINT "FK_RadiusCustomAttributes_RadiusProfiles" 
        FOREIGN KEY ("RadiusProfileId") REFERENCES "RadiusProfiles" ("Id")
);
```

## API Endpoints

### GET /api/radius/custom-attributes
Retrieve a paginated list of custom attributes.

**Query Parameters:**
- `page` (int, default: 1)
- `pageSize` (int, default: 50)
- `search` (string, optional)
- `linkType` ('user' | 'profile', optional)
- `radiusUserId` (int, optional)
- `radiusProfileId` (int, optional)
- `sortField` (string, optional)
- `sortDirection` ('asc' | 'desc', default: 'asc')
- `includeDeleted` (bool, default: false)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "attributeName": "Alc-SLA-Prof-Str",
      "attributeValue": "P1",
      "attributeType": 0,
      "operator": ":=",
      "linkType": "profile",
      "radiusProfileId": 3,
      "radiusProfileName": "Premium Plan",
      "priority": 10,
      "enabled": true,
      "createdAt": "2026-01-14T12:00:00Z",
      "updatedAt": "2026-01-14T12:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 50,
    "totalCount": 42,
    "totalPages": 1
  }
}
```

### GET /api/radius/custom-attributes/{id}
Get a single custom attribute by ID.

### POST /api/radius/custom-attributes
Create a new custom attribute.

**Request Body:**
```json
{
  "attributeName": "Alc-SLA-Prof-Str",
  "attributeValue": "P1",
  "attributeType": 0,
  "operator": ":=",
  "linkType": "profile",
  "radiusProfileId": 3,
  "priority": 10,
  "enabled": true
}
```

**Validation Rules:**
- `linkType` must be either "user" or "profile"
- When `linkType` is "user", `radiusUserId` is required
- When `linkType` is "profile", `radiusProfileId` is required
- The linked entity must exist and not be deleted

### PUT /api/radius/custom-attributes/{id}
Update an existing custom attribute.

**Request Body:** (all fields optional)
```json
{
  "attributeName": "Alc-SLA-Prof-Str",
  "attributeValue": "P2",
  "enabled": false
}
```

### DELETE /api/radius/custom-attributes/{id}
Soft delete a custom attribute.

### POST /api/radius/custom-attributes/{id}/restore
Restore a deleted custom attribute.

### DELETE /api/radius/custom-attributes/bulk
Bulk delete multiple custom attributes.

**Request Body:**
```json
[1, 2, 3, 4, 5]
```

## Frontend Usage

### Accessing the Feature

Navigate to **Radius → Custom Attributes** from the sidebar menu.

### Creating an Attribute

1. Click the **Add Attribute** button
2. Fill in the form:
   - **Attribute Name**: e.g., "Alc-SLA-Prof-Str"
   - **Attribute Value**: e.g., "P1"
   - **Type**: Reply (0) or Check (1)
   - **Operator**: :=, =, ==, or +=
   - **Priority**: Order of execution (0-999)
   - **Link Type**: Select "User" or "Profile"
   - **Link Target**: Select the specific user or profile
   - **Enabled**: Toggle to enable/disable
3. Click **Create**

### Editing an Attribute

1. Click the edit (pencil) icon next to any attribute
2. Modify the desired fields
3. Click **Update**

### Filtering Attributes

- **Search**: Filter by attribute name or value
- **Link Type Dropdown**: Filter by "All", "Users", or "Profiles"
- **Show Deleted Toggle**: Include soft-deleted attributes

### Bulk Operations

1. Select multiple attributes using checkboxes
2. Click **Delete (n)** button to delete all selected attributes

## Common Use Cases

### 1. Alcatel-Lucent SLA/Subscriber Profiles

Link QoS profiles to Radius Profiles:

```
Attribute Name: Alc-SLA-Prof-Str
Attribute Value: Premium-100M
Type: Reply (0)
Operator: :=
Link Type: profile
```

### 2. Custom DNS Servers

Override DNS for specific users:

```
Attribute Name: Alc-Primary-Dns
Attribute Value: 8.8.8.8
Type: Reply (0)
Operator: :=
Link Type: user
```

### 3. QoS Policies

Define upload/download policies:

```
Attribute Name: subscriber:sub-qos-policy-out
Attribute Value: P1
Type: Check (1)
Operator: :=
Link Type: profile
```

### 4. Session Limits

Set concurrent session limits per user:

```
Attribute Name: Simultaneous-Use
Attribute Value: 1
Type: Check (1)
Operator: ==
Link Type: user
```

## Example Data

The provided CSV data demonstrates typical custom attributes:

- **Profile-level attributes**: Applied to all users with that profile
- **User-level attributes**: Override profile settings for specific users
- **DNS configuration**: Custom DNS servers per profile/user
- **QoS policies**: Traffic shaping and quality of service
- **Nokia/Alcatel attributes**: Vendor-specific RADIUS attributes

## Seed Data

To populate sample data, run the SQL script:

```bash
psql -h localhost -U admin -d openradius -f Backend/seed_custom_attributes.sql
```

## Technical Details

### Backend Stack
- **Controller**: `RadiusCustomAttributeController.cs`
- **Model**: `RadiusCustomAttribute.cs`
- **Context**: Added to `ApplicationDbContext.cs`
- **Migration**: `AddRadiusCustomAttributes`

### Frontend Stack
- **Page Component**: `RadiusCustomAttributes.tsx`
- **API Service**: `radiusCustomAttributeApi.ts`
- **Routing**: Added to `App.tsx`
- **Navigation**: Added to `app-sidebar.tsx`
- **Breadcrumbs**: Added to `AppLayout.tsx`

### Localization
- English: `navigation.customAttributes` → "Custom Attributes"
- Arabic: `navigation.customAttributes` → "السمات المخصصة"

## Best Practices

1. **Use Priority**: Set priorities to control attribute order in RADIUS responses
2. **Descriptive Names**: Use clear, vendor-specific attribute names
3. **Profile vs User**: Prefer profile-level attributes for scalability; use user-level for exceptions
4. **Test Before Deploy**: Verify attributes work with your RADIUS server before production
5. **Document Custom Attributes**: Keep notes on vendor-specific attribute meanings
6. **Regular Cleanup**: Remove unused attributes to maintain database performance

## Troubleshooting

### Attribute not applying in RADIUS
- Verify the attribute is **Enabled**
- Check the **Priority** order
- Ensure **LinkType** and target ID are correct
- Confirm the RADIUS server supports the attribute

### Foreign key constraint errors
- Ensure the linked user/profile exists
- Check that the entity isn't soft-deleted
- Verify workspace context is correct

### UI not loading attributes
- Check browser console for API errors
- Verify backend service is running
- Confirm database migration was applied

## Future Enhancements

- [ ] Import/Export custom attributes (CSV/JSON)
- [ ] Attribute templates for common configurations
- [ ] Bulk edit operations
- [ ] Attribute validation based on RADIUS dictionaries
- [ ] History/audit log for attribute changes
- [ ] Clone attributes from one profile/user to another

## Related Documentation

- [RADIUS Protocol RFC 2865](https://tools.ietf.org/html/rfc2865)
- [Alcatel-Lucent RADIUS Attributes](https://documentation.nokia.com/)
- [FreeRADIUS Dictionary Files](https://freeradius.org/radiusd/man/dictionary.html)
