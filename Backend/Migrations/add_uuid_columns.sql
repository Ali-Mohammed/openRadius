-- Enterprise Solution: Add UUID columns to all tables while keeping int Id as primary key
-- This provides the best of both worlds: backward compatibility + UUID support for external APIs

DO $$
DECLARE
    table_record RECORD;
    schema_name TEXT := current_schema();
BEGIN
    -- Get all tables except FreeRADIUS core tables and system tables
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = schema_name
        AND tablename NOT IN (
            'radacct',           -- FreeRADIUS accounting
            'radcheck',          -- FreeRADIUS check
            'radgroupcheck',     -- FreeRADIUS group check
            'radgroupreply',     -- FreeRADIUS group reply
            'radpostauth',       -- FreeRADIUS post-auth
            'radreply',          -- FreeRADIUS reply
            'radusergroup',      -- FreeRADIUS user group
            '__EFMigrationsHistory' -- EF Core migrations
        )
        AND tablename NOT LIKE '_prisma%'
    LOOP
        -- Check if table has Id column and doesn't already have Uuid column
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = schema_name 
            AND table_name = table_record.tablename 
            AND column_name = 'Id'
        ) AND NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = schema_name 
            AND table_name = table_record.tablename 
            AND column_name = 'Uuid'
        ) THEN
            -- Add Uuid column with default value
            EXECUTE format('ALTER TABLE "%I" ADD COLUMN "Uuid" uuid NOT NULL DEFAULT gen_random_uuid()', table_record.tablename);
            
            -- Create index on Uuid for fast lookups
            EXECUTE format('CREATE INDEX "IX_%I_Uuid" ON "%I" ("Uuid")', table_record.tablename, table_record.tablename);
            
            -- Add unique constraint to ensure no duplicate UUIDs
            EXECUTE format('ALTER TABLE "%I" ADD CONSTRAINT "UK_%I_Uuid" UNIQUE ("Uuid")', table_record.tablename, table_record.tablename);
            
            RAISE NOTICE 'Added Uuid column to table: %', table_record.tablename;
        END IF;
    END LOOP;
END $$;

-- Summary
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
AND column_name = 'Uuid'
ORDER BY table_name;
