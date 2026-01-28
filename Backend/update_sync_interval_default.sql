-- Update existing SasRadiusIntegrations that have 0 interval to use default of 5 minutes
UPDATE "SasRadiusIntegrations"
SET "SyncOnlineUsersIntervalMinutes" = 5
WHERE "SyncOnlineUsersIntervalMinutes" = 0;
