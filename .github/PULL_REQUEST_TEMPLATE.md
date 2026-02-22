## Description

<!-- Provide a clear and concise description of what this PR does. -->

## Related Issue

<!-- Link the issue(s) this PR addresses. -->
Closes #

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] Configuration change
- [ ] Infrastructure / DevOps
- [ ] Performance improvement
- [ ] Security fix

## Component(s) Affected

- [ ] Backend API (.NET)
- [ ] Frontend (React)
- [ ] FreeRADIUS Integration
- [ ] Keycloak / Authentication
- [ ] Database / Migrations
- [ ] Docker / Infrastructure
- [ ] Billing / Payments
- [ ] Microservices
- [ ] Documentation

## Enterprise Architecture Checklist

- [ ] **Clean Architecture** — Business logic is in Services, not Controllers
- [ ] **UUID Strategy** — External APIs use UUIDs; internal IDs are never exposed
- [ ] **DTO Layer** — Request/Response uses DTOs, not entities directly
- [ ] **Audit Fields** — CreatedAt, CreatedBy, UpdatedAt, UpdatedBy are populated
- [ ] **Soft Delete** — Uses IsDeleted/DeletedAt/DeletedBy (no hard deletes)
- [ ] **RBAC Permissions** — New endpoints have proper permission checks (`resource.action` pattern)
- [ ] **Permissions Seeded** — New permissions are added to seed data and assigned to appropriate roles
- [ ] N/A — This PR does not involve backend/data changes

## Testing

- [ ] Unit tests added / updated
- [ ] Integration tests added / updated
- [ ] Manual testing performed
- [ ] No tests needed (explain below)

### Test Details

<!-- Describe what was tested and how. -->

## Database Changes

- [ ] New migration(s) added
- [ ] Seed data updated
- [ ] No database changes

## API Changes

- [ ] New endpoint(s) added
- [ ] Existing endpoint(s) modified
- [ ] API documentation updated
- [ ] No API changes

<!-- If API changes exist, list endpoints below (use UUID paths): -->
<!-- e.g., POST /api/resource, GET /api/resource/{uuid} -->

## Security Considerations

- [ ] No sensitive data exposed (tokens, passwords, PII, internal IDs)
- [ ] Input validation added where needed
- [ ] Authorization checks in place
- [ ] No security implications

## Screenshots / Recordings

<!-- If applicable, add screenshots or recordings of UI changes. -->

## Deployment Notes

<!-- Any special deployment steps, environment variables, or configuration needed? -->

## Pre-merge Checklist

- [ ] Code follows project conventions and architecture guidelines
- [ ] Self-reviewed the code
- [ ] No compiler warnings or lint errors introduced
- [ ] Documentation updated (if applicable)
- [ ] All CI checks pass
