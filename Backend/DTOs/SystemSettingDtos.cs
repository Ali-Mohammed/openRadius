namespace Backend.DTOs;

/// <summary>
/// Response DTO for a single system setting.
/// Exposes UUID (never internal ID) per enterprise identifier strategy.
/// </summary>
public class SystemSettingDto
{
    public Guid Uuid { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public bool IsEditable { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? UpdatedByEmail { get; set; }
}

/// <summary>
/// Focused DTO for the Swagger on/off state.
/// </summary>
public class SwaggerSettingResponseDto
{
    public bool Enabled { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? UpdatedByEmail { get; set; }
}

/// <summary>
/// Request DTO to toggle Swagger.
/// </summary>
public class SwaggerSettingRequestDto
{
    public bool Enabled { get; set; }
}
