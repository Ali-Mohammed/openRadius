using System;
using System.Collections.Generic;

namespace Backend.Temp.Models;

public partial class Permission
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string Category { get; set; } = null!;

    public DateTime CreatedAt { get; set; }
}
