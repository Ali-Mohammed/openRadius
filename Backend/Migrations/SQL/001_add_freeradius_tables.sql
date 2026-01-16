-- FreeRADIUS PostgreSQL Schema for version 3.2
-- Add FreeRADIUS tables to openradius database

-- Table structure for radacct
CREATE TABLE IF NOT EXISTS radacct (
  radacctid bigserial PRIMARY KEY,
  acctsessionid varchar(64) NOT NULL,
  acctuniqueid varchar(32) NOT NULL UNIQUE,
  username varchar(253),
  realm varchar(64),
  nasipaddress inet NOT NULL,
  nasportid varchar(32),
  nasporttype varchar(32),
  acctstarttime timestamp with time zone,
  acctupdatetime timestamp with time zone,
  acctstoptime timestamp with time zone,
  acctinterval bigint,
  acctsessiontime bigint,
  acctauthentic varchar(32),
  connectinfo_start varchar(128),
  connectinfo_stop varchar(128),
  acctinputoctets bigint,
  acctoutputoctets bigint,
  calledstationid varchar(50),
  callingstationid varchar(50),
  acctterminatecause varchar(32),
  servicetype varchar(32),
  framedprotocol varchar(32),
  framedipaddress inet,
  framedipv6address inet,
  framedipv6prefix inet,
  framedinterfaceid varchar(44),
  delegatedipv6prefix inet,
  class varchar(64)
);

-- Indexes for radacct
CREATE INDEX IF NOT EXISTS radacct_username_idx ON radacct (username);
CREATE INDEX IF NOT EXISTS radacct_framedipaddress_idx ON radacct (framedipaddress);
CREATE INDEX IF NOT EXISTS radacct_nasipaddress_idx ON radacct (nasipaddress);
CREATE INDEX IF NOT EXISTS radacct_acctsessionid_idx ON radacct (acctsessionid);
CREATE INDEX IF NOT EXISTS radacct_acctstarttime_idx ON radacct (acctstarttime);
CREATE INDEX IF NOT EXISTS radacct_acctstoptime_idx ON radacct (acctstoptime);
CREATE INDEX IF NOT EXISTS radacct_nasipaddress_acctstarttime_idx ON radacct (nasipaddress, acctstarttime);

-- Table structure for radcheck
CREATE TABLE IF NOT EXISTS radcheck (
  id serial PRIMARY KEY,
  username varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op varchar(2) NOT NULL DEFAULT '==',
  value varchar(253) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS radcheck_username_idx ON radcheck (username);

-- Table structure for radgroupcheck
CREATE TABLE IF NOT EXISTS radgroupcheck (
  id serial PRIMARY KEY,
  groupname varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op varchar(2) NOT NULL DEFAULT '==',
  value varchar(253) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS radgroupcheck_groupname_idx ON radgroupcheck (groupname);

-- Table structure for radgroupreply
CREATE TABLE IF NOT EXISTS radgroupreply (
  id serial PRIMARY KEY,
  groupname varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op varchar(2) NOT NULL DEFAULT '=',
  value varchar(253) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS radgroupreply_groupname_idx ON radgroupreply (groupname);

-- Table structure for radreply
CREATE TABLE IF NOT EXISTS radreply (
  id serial PRIMARY KEY,
  username varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op varchar(2) NOT NULL DEFAULT '=',
  value varchar(253) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS radreply_username_idx ON radreply (username);

-- Table structure for radusergroup
CREATE TABLE IF NOT EXISTS radusergroup (
  id serial PRIMARY KEY,
  username varchar(64) NOT NULL DEFAULT '',
  groupname varchar(64) NOT NULL DEFAULT '',
  priority integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS radusergroup_username_idx ON radusergroup (username);

-- Table structure for radpostauth
CREATE TABLE IF NOT EXISTS radpostauth (
  id bigserial PRIMARY KEY,
  username varchar(253) NOT NULL,
  pass varchar(128),
  reply varchar(32),
  authdate timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS radpostauth_username_idx ON radpostauth (username);
CREATE INDEX IF NOT EXISTS radpostauth_authdate_idx ON radpostauth (authdate);

-- Table structure for nas (Network Access Servers)
CREATE TABLE IF NOT EXISTS nas (
  id serial PRIMARY KEY,
  nasname varchar(128) NOT NULL UNIQUE,
  shortname varchar(32),
  type varchar(30) NOT NULL DEFAULT 'other',
  ports integer,
  secret varchar(60) NOT NULL,
  server varchar(64),
  community varchar(50),
  description varchar(200)
);

CREATE INDEX IF NOT EXISTS nas_nasname_idx ON nas (nasname);

-- Create a trigger function to sync RadiusUsers to radcheck
CREATE OR REPLACE FUNCTION sync_radius_users_to_radcheck()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Only sync if user is not deleted and has a password
        IF NEW."DeletedAt" IS NULL AND NEW."Password" IS NOT NULL AND NEW."Password" != '' THEN
            -- Delete existing entries for this user
            DELETE FROM radcheck WHERE username = NEW."Username";
            
            -- Insert Cleartext-Password
            INSERT INTO radcheck (username, attribute, op, value)
            VALUES (NEW."Username", 'Cleartext-Password', ':=', NEW."Password");
            
            -- If user has a profile with pool, add Framed-Pool
            IF NEW."ProfileId" IS NOT NULL THEN
                INSERT INTO radcheck (username, attribute, op, value)
                SELECT NEW."Username", 'Framed-Pool', ':=', rp."Pool"
                FROM "RadiusProfiles" rp
                WHERE rp."Id" = NEW."ProfileId" AND rp."Pool" IS NOT NULL;
            END IF;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW."DeletedAt" IS NOT NULL)) THEN
        -- Remove from radcheck when user is deleted
        DELETE FROM radcheck WHERE username = COALESCE(NEW."Username", OLD."Username");
        RETURN COALESCE(NEW, OLD);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on RadiusUsers
DROP TRIGGER IF EXISTS trigger_sync_radius_users ON "RadiusUsers";
CREATE TRIGGER trigger_sync_radius_users
    AFTER INSERT OR UPDATE OR DELETE ON "RadiusUsers"
    FOR EACH ROW
    EXECUTE FUNCTION sync_radius_users_to_radcheck();

-- Create a trigger function to sync RadiusProfiles to radgroupreply
CREATE OR REPLACE FUNCTION sync_radius_profiles_to_radgroupreply()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Only sync if profile is enabled
        IF NEW."Enabled" = true THEN
            -- Delete existing entries for this profile
            DELETE FROM radgroupreply WHERE groupname = 'profile_' || NEW."Id"::text;
            
            -- Add download speed limit (in Kbps)
            INSERT INTO radgroupreply (groupname, attribute, op, value)
            VALUES ('profile_' || NEW."Id"::text, 'WISPr-Bandwidth-Max-Down', ':=', (NEW."Downrate")::text);
            
            -- Add upload speed limit (in Kbps)
            INSERT INTO radgroupreply (groupname, attribute, op, value)
            VALUES ('profile_' || NEW."Id"::text, 'WISPr-Bandwidth-Max-Up', ':=', (NEW."Uprate")::text);
            
            -- Add IP pool if specified
            IF NEW."Pool" IS NOT NULL THEN
                INSERT INTO radgroupreply (groupname, attribute, op, value)
                VALUES ('profile_' || NEW."Id"::text, 'Framed-Pool', ':=', NEW."Pool");
            END IF;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        -- Remove from radgroupreply when profile is deleted
        DELETE FROM radgroupreply WHERE groupname = 'profile_' || OLD."Id"::text;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on RadiusProfiles
DROP TRIGGER IF EXISTS trigger_sync_radius_profiles ON "RadiusProfiles";
CREATE TRIGGER trigger_sync_radius_profiles
    AFTER INSERT OR UPDATE OR DELETE ON "RadiusProfiles"
    FOR EACH ROW
    EXECUTE FUNCTION sync_radius_profiles_to_radgroupreply();

-- Create a trigger function to sync user-profile assignments to radusergroup
CREATE OR REPLACE FUNCTION sync_radius_user_profiles_to_radusergroup()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Only sync if user is not deleted and has a profile
        IF NEW."DeletedAt" IS NULL AND NEW."ProfileId" IS NOT NULL THEN
            -- Delete existing profile group assignment for this user
            DELETE FROM radusergroup WHERE username = NEW."Username" AND groupname LIKE 'profile_%';
            
            -- Add user to profile group
            INSERT INTO radusergroup (username, groupname, priority)
            VALUES (NEW."Username", 'profile_' || NEW."ProfileId"::text, 1);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW."DeletedAt" IS NOT NULL)) THEN
        -- Remove profile group assignment when user is deleted
        DELETE FROM radusergroup WHERE username = COALESCE(NEW."Username", OLD."Username") AND groupname LIKE 'profile_%';
        RETURN COALESCE(NEW, OLD);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on RadiusUsers for profile assignments
DROP TRIGGER IF EXISTS trigger_sync_user_profiles ON "RadiusUsers";
CREATE TRIGGER trigger_sync_user_profiles
    AFTER INSERT OR UPDATE OR DELETE ON "RadiusUsers"
    FOR EACH ROW
    EXECUTE FUNCTION sync_radius_user_profiles_to_radusergroup();

-- Create a trigger function to sync RadiusCustomAttributes to radreply
CREATE OR REPLACE FUNCTION sync_radius_custom_attributes_to_radreply()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Only sync if attribute is enabled and not deleted and linked to a user
        IF NEW."Enabled" = true AND NEW."DeletedAt" IS NULL AND NEW."LinkType" = 'User' AND NEW."RadiusUserId" IS NOT NULL THEN
            -- Get username
            DECLARE
                v_username varchar(64);
            BEGIN
                SELECT "Username" INTO v_username FROM "RadiusUsers" WHERE "Id" = NEW."RadiusUserId";
                
                IF v_username IS NOT NULL THEN
                    -- Delete existing entry for this attribute and user
                    DELETE FROM radreply 
                    WHERE username = v_username 
                    AND attribute = NEW."AttributeName";
                    
                    -- Insert new attribute
                    INSERT INTO radreply (username, attribute, op, value)
                    VALUES (v_username, NEW."AttributeName", NEW."Operator", NEW."AttributeValue");
                END IF;
            END;
        ELSIF (TG_OP = 'UPDATE' AND (NEW."Enabled" = false OR NEW."DeletedAt" IS NOT NULL)) OR TG_OP = 'DELETE' THEN
            -- Remove from radreply when attribute is disabled or deleted
            DECLARE
                v_username varchar(64);
                v_attr_name varchar(64);
                v_user_id integer;
            BEGIN
                v_attr_name := COALESCE(NEW."AttributeName", OLD."AttributeName");
                v_user_id := COALESCE(NEW."RadiusUserId", OLD."RadiusUserId");
                
                IF v_user_id IS NOT NULL THEN
                    SELECT "Username" INTO v_username FROM "RadiusUsers" WHERE "Id" = v_user_id;
                    
                    IF v_username IS NOT NULL THEN
                        DELETE FROM radreply 
                        WHERE username = v_username 
                        AND attribute = v_attr_name;
                    END IF;
                END IF;
            END;
        END IF;
        RETURN COALESCE(NEW, OLD);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on RadiusCustomAttributes
DROP TRIGGER IF EXISTS trigger_sync_custom_attributes ON "RadiusCustomAttributes";
CREATE TRIGGER trigger_sync_custom_attributes
    AFTER INSERT OR UPDATE OR DELETE ON "RadiusCustomAttributes"
    FOR EACH ROW
    EXECUTE FUNCTION sync_radius_custom_attributes_to_radreply();

-- Initial sync: Populate radcheck from existing RadiusUsers
INSERT INTO radcheck (username, attribute, op, value)
SELECT "Username", 'Cleartext-Password', ':=', "Password"
FROM "RadiusUsers"
WHERE "DeletedAt" IS NULL AND "Password" IS NOT NULL AND "Password" != ''
ON CONFLICT DO NOTHING;

-- Initial sync: Populate radgroupreply from existing RadiusProfiles
INSERT INTO radgroupreply (groupname, attribute, op, value)
SELECT 'profile_' || "Id"::text, 'WISPr-Bandwidth-Max-Down', ':=', "Downrate"::text
FROM "RadiusProfiles"
WHERE "Enabled" = true
UNION ALL
SELECT 'profile_' || "Id"::text, 'WISPr-Bandwidth-Max-Up', ':=', "Uprate"::text
FROM "RadiusProfiles"
WHERE "Enabled" = true
UNION ALL
SELECT 'profile_' || "Id"::text, 'Framed-Pool', ':=', "Pool"
FROM "RadiusProfiles"
WHERE "Enabled" = true AND "Pool" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Initial sync: Populate radusergroup from existing user-profile assignments
INSERT INTO radusergroup (username, groupname, priority)
SELECT "Username", 'profile_' || "ProfileId"::text, 1
FROM "RadiusUsers"
WHERE "DeletedAt" IS NULL AND "ProfileId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Initial sync: Populate radreply from existing RadiusCustomAttributes
INSERT INTO radreply (username, attribute, op, value)
SELECT ru."Username", rca."AttributeName", rca."Operator", rca."AttributeValue"
FROM "RadiusCustomAttributes" rca
JOIN "RadiusUsers" ru ON rca."RadiusUserId" = ru."Id"
WHERE rca."Enabled" = true 
  AND rca."DeletedAt" IS NULL 
  AND rca."LinkType" = 'User' 
  AND rca."RadiusUserId" IS NOT NULL
ON CONFLICT DO NOTHING;
