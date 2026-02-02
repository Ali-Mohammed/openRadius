-- Add advanced fields to BillingProfiles table
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "IsOffer" boolean NOT NULL DEFAULT false;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "Platform" text;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "TotalQuantity" integer;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "UsedQuantity" integer NOT NULL DEFAULT 0;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "UserType" text;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "ExpirationDays" integer;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "OfferStartDate" timestamp with time zone;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "OfferEndDate" timestamp with time zone;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "RequiresApproval" boolean NOT NULL DEFAULT false;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "Priority" integer;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "Color" text;
ALTER TABLE "BillingProfiles" ADD COLUMN IF NOT EXISTS "Icon" text;
