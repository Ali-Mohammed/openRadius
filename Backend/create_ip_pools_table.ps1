$connectionString = "Host=localhost;Port=5432;Database=openradius_workspace_1;Username=admin;Password=admin123"

$sql = @"
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

CREATE INDEX IF NOT EXISTS idx_radius_ip_pools_name ON radius_ip_pools(name);
CREATE INDEX IF NOT EXISTS idx_radius_ip_pools_workspace_id ON radius_ip_pools(workspace_id);
CREATE INDEX IF NOT EXISTS idx_radius_ip_pools_deleted_at ON radius_ip_pools(deleted_at);
"@

try {
    Add-Type -Path "C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.1\System.Data.Common.dll"
    $assembly = [System.Reflection.Assembly]::LoadFrom("$env:USERPROFILE\.nuget\packages\npgsql\8.0.0\lib\net8.0\Npgsql.dll")
    
    $connection = New-Object Npgsql.NpgsqlConnection($connectionString)
    $connection.Open()
    
    $command = $connection.CreateCommand()
    $command.CommandText = $sql
    $command.ExecuteNonQuery() | Out-Null
    
    Write-Host "Table created successfully!" -ForegroundColor Green
    
    $connection.Close()
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
