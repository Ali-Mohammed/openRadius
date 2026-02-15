-- ============================================================================
-- Fluent Bit Lua Sanitizer for RADIUS Accounting
-- Ensures numeric fields have proper defaults for ClickHouse type safety
-- ============================================================================

function sanitize_accounting(tag, timestamp, record)
    local modified = false

    -- Ensure numeric fields default to 0
    local numeric_fields = {
        "acctsessiontime", "acctinterval",
        "acctinputoctets", "acctoutputoctets",
        "acctinputgigawords", "acctoutputgigawords"
    }

    for _, field in ipairs(numeric_fields) do
        if record[field] == nil or record[field] == "" then
            record[field] = 0
            modified = true
        else
            local num = tonumber(record[field])
            if num == nil then
                record[field] = 0
                modified = true
            else
                record[field] = num
                modified = true
            end
        end
    end

    -- Ensure string fields default to empty string
    local string_fields = {
        "realm", "nasportid", "nasporttype",
        "acctauthentic", "connectinfo_start", "connectinfo_stop",
        "calledstationid", "callingstationid",
        "acctterminatecause", "servicetype", "framedprotocol",
        "framedipaddress"
    }

    for _, field in ipairs(string_fields) do
        if record[field] == nil then
            record[field] = ""
            modified = true
        end
    end

    -- Compute total octets with gigaword support
    -- total = (gigawords << 32) + octets
    if record["acctinputgigawords"] and tonumber(record["acctinputgigawords"]) > 0 then
        record["acctinputoctets"] = (tonumber(record["acctinputgigawords"]) * 4294967296) + tonumber(record["acctinputoctets"])
        modified = true
    end
    if record["acctoutputgigawords"] and tonumber(record["acctoutputgigawords"]) > 0 then
        record["acctoutputoctets"] = (tonumber(record["acctoutputgigawords"]) * 4294967296) + tonumber(record["acctoutputoctets"])
        modified = true
    end

    -- Remove gigaword fields (not in ClickHouse schema)
    record["acctinputgigawords"] = nil
    record["acctoutputgigawords"] = nil

    if modified then
        return 1, timestamp, record
    end
    return 0, timestamp, record
end
