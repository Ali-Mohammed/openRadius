# Export/Import Integrations Feature

## Overview
Added export and import functionality for SAS Radius integrations to enable backup and restore of integration configurations.

## Backend Changes

### SasRadiusIntegrationController.cs

#### Export Endpoint
- **Route**: `GET /api/workspaces/{WorkspaceId}/sas-radius/export`
- **Description**: Exports all active (non-deleted) integrations as a JSON file
- **Response**: JSON file download with filename format: `sas-radius-integrations-{timestamp}.json`
- **Fields Exported**:
  - Name
  - Url
  - Username
  - Password
  - UseHttps
  - IsActive
  - MaxItemInPagePerRequest
  - Action
  - Description

#### Import Endpoint
- **Route**: `POST /api/workspaces/{WorkspaceId}/sas-radius/import`
- **Description**: Imports integrations from JSON file
- **Request Body**: Array of `SasRadiusIntegrationImport` objects
- **Behavior**:
  - Updates existing integrations if name matches
  - Creates new integrations if name doesn't exist
  - Skips invalid entries and reports errors
- **Response**:
  ```json
  {
    "message": "Import completed: X integrations imported/updated, Y skipped",
    "imported": 5,
    "skipped": 0,
    "errors": []
  }
  ```

#### New Import Model
```csharp
public class SasRadiusIntegrationImport
{
    public required string Name { get; set; }
    public required string Url { get; set; }
    public required string Username { get; set; }
    public required string Password { get; set; }
    public bool UseHttps { get; set; }
    public bool IsActive { get; set; }
    public int MaxItemInPagePerRequest { get; set; }
    public required string Action { get; set; }
    public string? Description { get; set; }
}
```

## Frontend Changes

### sasRadiusApi.ts

#### Export Function
```typescript
exportIntegrations: async (workspaceId: number): Promise<void> => {
  const response = await apiClient.get(`/api/workspaces/${workspaceId}/sas-radius/export`, {
    responseType: 'blob'
  })
  
  // Create blob URL and trigger download
  const blob = new Blob([response.data], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `sas-radius-integrations-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
```

#### Import Function
```typescript
importIntegrations: async (workspaceId: number, file: File): Promise<Response> => {
  const text = await file.text()
  const integrations = JSON.parse(text)
  const response = await apiClient.post(`/api/workspaces/${workspaceId}/sas-radius/import`, integrations)
  return response.data
}
```

### WorkspaceSettings.tsx

#### New UI Elements
- **Export Button**: Downloads all active integrations as JSON
  - Disabled when no integrations exist
  - Shows loading state during export
  - Icon: Download

- **Import Button**: Uploads JSON file to restore integrations
  - Opens file picker for .json files
  - Shows loading state during import
  - Icon: Upload

- **Hidden File Input**: Handles file selection
  - Accepts only .json files
  - Resets after each import

#### Mutations
```typescript
const exportMutation = useMutation({
  mutationFn: () => sasRadiusApi.exportIntegrations(Number(currentWorkspaceId)),
  onSuccess: () => toast.success('Integrations exported successfully'),
  onError: (error) => toast.error('Failed to export integrations')
})

const importMutation = useMutation({
  mutationFn: (file: File) => sasRadiusApi.importIntegrations(Number(currentWorkspaceId), file),
  onSuccess: (response) => {
    queryClient.invalidateQueries(['sas-radius-integrations'])
    toast.success(response.message)
    if (response.errors?.length > 0) {
      response.errors.forEach(error => toast.error(error))
    }
  },
  onError: (error) => toast.error('Failed to import integrations')
})
```

## Usage

### Exporting Integrations
1. Navigate to Settings → Integrations → SAS Radius
2. Ensure you're on the "Active" tab (not Trash)
3. Click the "Export" button
4. JSON file will be downloaded automatically with timestamp

### Importing Integrations
1. Navigate to Settings → Integrations → SAS Radius
2. Ensure you're on the "Active" tab (not Trash)
3. Click the "Import" button
4. Select a JSON file from your computer
5. Review the toast messages for import results
6. Existing integrations with matching names will be updated
7. New integrations will be created

## JSON File Format

### Example Export
```json
[
  {
    "name": "Main RADIUS Server",
    "url": "radius.example.com",
    "username": "admin",
    "password": "encrypted_password",
    "useHttps": true,
    "isActive": true,
    "maxItemInPagePerRequest": 100,
    "action": "sync",
    "description": "Primary RADIUS integration"
  },
  {
    "name": "Secondary RADIUS",
    "url": "192.168.1.100",
    "username": "radiusadmin",
    "password": "encrypted_password",
    "useHttps": false,
    "isActive": false,
    "maxItemInPagePerRequest": 50,
    "action": "sync",
    "description": "Backup server"
  }
]
```

## Features

### Export Features
- ✅ Exports all active (non-deleted) integrations
- ✅ Includes all configuration fields
- ✅ Formatted JSON with indentation
- ✅ Automatic filename with timestamp
- ✅ Client-side file download (no server file storage)

### Import Features
- ✅ Validates JSON structure
- ✅ Updates existing integrations by name
- ✅ Creates new integrations
- ✅ Handles errors gracefully
- ✅ Reports import statistics
- ✅ Shows individual error messages
- ✅ Invalidates cache after import

### Security Considerations
- ⚠️ Passwords are exported in plain text - store export files securely
- ⚠️ Workspace isolation - can only export/import within same workspace
- ⚠️ Deleted integrations are not included in exports
- ⚠️ Import validates workspace ID to prevent cross-workspace imports

## Error Handling
- Invalid JSON format → Error toast
- Missing required fields → Skips item, reports in errors array
- Duplicate names → Updates existing integration
- Network errors → Error toast with details
- Empty file → "No integrations provided" error

## Testing
To test the feature:
1. Create some test integrations
2. Export them to JSON
3. Delete/modify the integrations
4. Import the JSON file
5. Verify integrations are restored/updated correctly
