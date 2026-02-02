-- Migration: Add BillingProfileUsers table for direct user assignment
-- Date: 2026-02-03
-- Note: UserId and AssignedBy reference the Users table in the master database
-- No FK constraints are added since Users table is in a different database context

-- Create BillingProfileUsers table
CREATE TABLE IF NOT EXISTS "BillingProfileUsers" (
    "Id" SERIAL PRIMARY KEY,
    "BillingProfileId" INTEGER NOT NULL,
    "UserId" INTEGER NOT NULL,
    "AssignedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    "AssignedBy" INTEGER,
    CONSTRAINT "FK_BillingProfileUsers_BillingProfiles" FOREIGN KEY ("BillingProfileId") 
        REFERENCES "BillingProfiles"("Id") ON DELETE CASCADE
    -- Note: No FK constraint for UserId and AssignedBy - they reference master database Users table
);

-- Create unique index to prevent duplicate assignments
CREATE UNIQUE INDEX IF NOT EXISTS "IX_BillingProfileUsers_BillingProfileId_UserId" 
    ON "BillingProfileUsers" ("BillingProfileId", "UserId");

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "IX_BillingProfileUsers_BillingProfileId" 
    ON "BillingProfileUsers" ("BillingProfileId");

CREATE INDEX IF NOT EXISTS "IX_BillingProfileUsers_UserId" 
    ON "BillingProfileUsers" ("UserId");

COMMENT ON TABLE "BillingProfileUsers" IS 'Junction table for direct user assignment to billing profiles';
COMMENT ON COLUMN "BillingProfileUsers"."BillingProfileId" IS 'Reference to the billing profile';
COMMENT ON COLUMN "BillingProfileUsers"."UserId" IS 'Reference to the user being assigned (in master database)';
COMMENT ON COLUMN "BillingProfileUsers"."AssignedAt" IS 'When the user was assigned to this profile';
COMMENT ON COLUMN "BillingProfileUsers"."AssignedBy" IS 'Who assigned this user to the profile (in master database)';
