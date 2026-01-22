-- Performance indexes for user lookups in high-load scenarios
CREATE INDEX IF NOT EXISTS "IX_Users_Email" ON "Users" ("Email");
CREATE INDEX IF NOT EXISTS "IX_Users_KeycloakUserId" ON "Users" ("KeycloakUserId") WHERE "KeycloakUserId" IS NOT NULL;

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS "IX_Users_DisabledAt" ON "Users" ("DisabledAt") WHERE "DisabledAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Workspaces_Status" ON "Workspaces" ("Status");
CREATE INDEX IF NOT EXISTS "IX_Workspaces_CreatedBy" ON "Workspaces" ("CreatedBy");
