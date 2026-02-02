-- Add UseSas4ForLiveSessions column to SasRadiusIntegrations table
-- Run this script on each workspace database

ALTER TABLE "SasRadiusIntegrations" 
ADD COLUMN IF NOT EXISTS "UseSas4ForLiveSessions" boolean NOT NULL DEFAULT false;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'SasRadiusIntegrations' 
AND column_name = 'UseSas4ForLiveSessions';
