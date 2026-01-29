-- Add new tracking columns to SessionSyncProgresses table
ALTER TABLE "SessionSyncProgresses" 
ADD COLUMN IF NOT EXISTS "NewSessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "UpdatedSessions" INTEGER NOT NULL DEFAULT 0;

-- Add new columns and rename existing ones in SessionSyncLogs table
ALTER TABLE "SessionSyncLogs"
ADD COLUMN IF NOT EXISTS "TotalSessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "NewSessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "UpdatedSessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "FailedSessions" INTEGER NOT NULL DEFAULT 0;

-- Copy data from old columns to new columns (if they have data)
UPDATE "SessionSyncLogs"
SET "TotalSessions" = "TotalUsers",
    "NewSessions" = 0,
    "UpdatedSessions" = "SyncedUsers",
    "FailedSessions" = "FailedUsers"
WHERE "TotalSessions" = 0;

-- Optional: Drop old columns after data migration
-- Uncomment these lines after verifying data migration
-- ALTER TABLE "SessionSyncLogs" DROP COLUMN IF EXISTS "TotalUsers";
-- ALTER TABLE "SessionSyncLogs" DROP COLUMN IF EXISTS "SyncedUsers";
-- ALTER TABLE "SessionSyncLogs" DROP COLUMN IF EXISTS "FailedUsers";
