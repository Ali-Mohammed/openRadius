# Enterprise Application Instructions

## Architecture
- This is an enterprise-grade application
- Follow Clean Architecture principles
- Separation of concerns is mandatory
- No business logic in controllers
- Services handle business logic
- Repositories handle data access
- DTO layer is required
- Mapping layer is required (Entity ↔ DTO)

## Identifiers Strategy
### Internal IDs
- Use `int` / `bigint` as primary keys in the database
- Internal IDs are:
  - For internal use only
  - Never exposed via APIs
  - Never returned in API responses
  - Never accepted in API requests
- Optimized for:
  - Performance
  - Indexing speed
  - Storage efficiency

### External/Public IDs (API)
- Use `UUID` / `GUID` for all external-facing operations
- UUID rules:
  - Used in all APIs
  - Used for:
    - Create
    - Read
    - Update
    - Delete
    - View
    - Search
    - Relations
  - Used in URLs and request bodies
  - Used as public identifiers
- APIs must never expose internal `int` IDs

## API Design
- Public API uses UUID only
- REST endpoints must use UUID
  - Example: `/api/users/{uuid}`
- No endpoint should accept or return internal IDs

## Security
- Do not expose internal database structure
- UUIDs are required for external communication
- No ID enumeration via APIs

## Performance
- Internal DB operations use int/bigint
- External operations use UUID mapping
- Index UUID columns properly
- Composite indexes allowed where needed

## Code Quality
- SOLID principles
- Small methods
- Single responsibility
- Clear naming
- Explicit intent
- Enterprise logging
- Centralized error handling
- No magic numbers

## Enterprise Standards
- Auditing fields required:
- CreatedAt
- CreatedBy
- UpdatedAt
- UpdatedBy
- DeletedAt 
- DeletedBy 
- IsDeleted 
- Soft delete pattern preferred
- Versioning for concurrency (RowVersion / ETag)