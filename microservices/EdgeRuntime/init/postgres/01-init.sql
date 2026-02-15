-- ============================================================================
-- EdgeRuntime PostgreSQL Initialization
-- Creates schemas for CDC-synced data + FreeRADIUS post-auth/check/reply
--
-- NOTE: Accounting data is stored exclusively in ClickHouse (insert-only).
--       No radacct table needed in PostgreSQL.
-- ============================================================================

-- ===========================================
-- 1. CDC-Synced Tables (auto-created by Debezium JDBC Sink, but ensure schema)
-- ===========================================

-- RadiusUsers - synced from cloud via CDC
-- Used by FreeRADIUS SQL module for user authentication (authorize_check_query)
CREATE TABLE IF NOT EXISTS public."RadiusUsers"
(
    "Id"                   integer                  not null
        constraint "PK_RadiusUsers"
            primary key,
    "Uuid"                 uuid                     not null,
    "ExternalId"           integer                  not null,
    "Username"             text,
    "Password"             text,
    "Firstname"            text,
    "Lastname"             text,
    "City"                 text,
    "Phone"                text,
    "ProfileId"            integer,
    "ProfileBillingId"     integer,
    "Balance"              double precision         not null,
    "LoanBalance"          double precision         not null,
    "Expiration"           timestamp(6) with time zone,
    "LastOnline"           timestamp(6) with time zone,
    "ParentId"             integer,
    "Email"                text,
    "StaticIp"             text,
    "Enabled"              boolean                  not null,
    "Company"              text,
    "Notes"                text,
    "DeviceSerialNumber"   text,
    "SimultaneousSessions" integer                  not null,
    "Address"              text,
    "ContractId"           text,
    "NationalId"           text,
    "MikrotikIpv6Prefix"   text,
    "GroupId"              integer,
    "GpsLat"               text,
    "GpsLng"               text,
    "Street"               text,
    "SiteId"               integer,
    "PinTries"             integer                  not null,
    "RemainingDays"        integer                  not null,
    "OnlineStatus"         integer                  not null,
    "UsedTraffic"          bigint                   not null,
    "AvailableTraffic"     bigint                   not null,
    "ParentUsername"       text,
    "DebtDays"             integer                  not null,
    "ZoneId"               integer,
    "IsDeleted"            boolean                  not null,
    "DeletedAt"            timestamp(6) with time zone,
    "DeletedBy"            integer,
    "CreatedAt"            timestamp(6) with time zone not null,
    "UpdatedAt"            timestamp(6) with time zone not null,
    "LastSyncedAt"         timestamp(6) with time zone
);

CREATE INDEX IF NOT EXISTS idx_radiususers_username ON public."RadiusUsers"("Username");
CREATE INDEX IF NOT EXISTS idx_radiususers_enabled ON public."RadiusUsers"("Enabled");
CREATE INDEX IF NOT EXISTS idx_radiususers_profileid ON public."RadiusUsers"("ProfileId");
CREATE INDEX IF NOT EXISTS idx_radiususers_expiration ON public."RadiusUsers"("Expiration");

-- ===========================================
-- 2. FreeRADIUS Post-Auth Table
-- ===========================================

CREATE TABLE IF NOT EXISTS public.radpostauth (
    id          bigserial PRIMARY KEY,
    username    varchar(253) NOT NULL,
    pass        varchar(128),
    reply       varchar(32),
    authdate    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS radpostauth_username_idx ON radpostauth (username);
CREATE INDEX IF NOT EXISTS radpostauth_authdate_idx ON radpostauth (authdate);

-- ===========================================
-- 3. FreeRADIUS Check/Reply Tables (optional, for local overrides)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.radcheck (
    id          serial PRIMARY KEY,
    username    varchar(64) NOT NULL DEFAULT '',
    attribute   varchar(64) NOT NULL DEFAULT '',
    op          varchar(2)  NOT NULL DEFAULT '==',
    value       varchar(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radcheck_username_idx ON radcheck (username);

CREATE TABLE IF NOT EXISTS public.radreply (
    id          serial PRIMARY KEY,
    username    varchar(64) NOT NULL DEFAULT '',
    attribute   varchar(64) NOT NULL DEFAULT '',
    op          varchar(2)  NOT NULL DEFAULT '=',
    value       varchar(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radreply_username_idx ON radreply (username);

CREATE TABLE IF NOT EXISTS public.radgroupcheck (
    id          serial PRIMARY KEY,
    groupname   varchar(64) NOT NULL DEFAULT '',
    attribute   varchar(64) NOT NULL DEFAULT '',
    op          varchar(2)  NOT NULL DEFAULT '==',
    value       varchar(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radgroupcheck_groupname_idx ON radgroupcheck (groupname);

CREATE TABLE IF NOT EXISTS public.radgroupreply (
    id          serial PRIMARY KEY,
    groupname   varchar(64) NOT NULL DEFAULT '',
    attribute   varchar(64) NOT NULL DEFAULT '',
    op          varchar(2)  NOT NULL DEFAULT '=',
    value       varchar(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radgroupreply_groupname_idx ON radgroupreply (groupname);

CREATE TABLE IF NOT EXISTS public.radusergroup (
    id          serial PRIMARY KEY,
    username    varchar(64) NOT NULL DEFAULT '',
    groupname   varchar(64) NOT NULL DEFAULT '',
    priority    integer     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS radusergroup_username_idx ON radusergroup (username);

-- ===========================================
-- 4. Grant permissions
-- ===========================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
