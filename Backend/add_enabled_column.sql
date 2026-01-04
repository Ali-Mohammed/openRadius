-- Add Enabled column with default value true
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Enabled" boolean NOT NULL DEFAULT true;

-- Ensure all existing users are enabled
UPDATE "Users" SET "Enabled" = true WHERE "Enabled" = false OR "Enabled" IS NULL;
