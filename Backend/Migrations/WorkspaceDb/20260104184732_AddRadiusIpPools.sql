-- Create radius_ip_pools table
CREATE TABLE IF NOT EXISTS radius_ip_pools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_ip VARCHAR(45) NOT NULL,
    end_ip VARCHAR(45) NOT NULL,
    lease_time INTEGER NOT NULL DEFAULT 24,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    workspace_id INTEGER NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_radius_ip_pools_name ON radius_ip_pools(name);
CREATE INDEX IF NOT EXISTS idx_radius_ip_pools_workspace_id ON radius_ip_pools(workspace_id);
CREATE INDEX IF NOT EXISTS idx_radius_ip_pools_deleted_at ON radius_ip_pools(deleted_at);

-- Add comment
COMMENT ON TABLE radius_ip_pools IS 'RADIUS IP address pools for workspace';
