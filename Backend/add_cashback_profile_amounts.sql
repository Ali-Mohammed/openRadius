CREATE TABLE IF NOT EXISTS "CashbackProfileAmounts" (
    "Id" SERIAL PRIMARY KEY,
    "CashbackGroupId" integer NOT NULL,
    "BillingProfileId" integer NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "FK_CashbackProfileAmounts_BillingProfiles_BillingProfileId"
        FOREIGN KEY ("BillingProfileId") 
        REFERENCES "BillingProfiles" ("Id") 
        ON DELETE CASCADE,
    CONSTRAINT "FK_CashbackProfileAmounts_CashbackGroups_CashbackGroupId"
        FOREIGN KEY ("CashbackGroupId") 
        REFERENCES "CashbackGroups" ("Id") 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_CashbackProfileAmounts_BillingProfileId"
    ON "CashbackProfileAmounts" ("BillingProfileId");

CREATE INDEX IF NOT EXISTS "IX_CashbackProfileAmounts_CashbackGroupId_BillingProfileId"
    ON "CashbackProfileAmounts" ("CashbackGroupId", "BillingProfileId");
