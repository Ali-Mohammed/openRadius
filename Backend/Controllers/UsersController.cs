using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UsersController> _logger;

    public UsersController(ApplicationDbContext context, ILogger<UsersController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<User>>> GetUsers()
    {
        return await _context.Users.ToListAsync();
    }

    [HttpGet("me")]
    public ActionResult<object> GetCurrentUser()
    {
        var claims = User.Claims.Select(c => new { c.Type, c.Value });
        
        // Extract name
        var name = User.Claims.FirstOrDefault(c => c.Type == "name")?.Value;
        
        // Extract email
        var email = User.Claims.FirstOrDefault(c => 
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" ||
            c.Type == "email")?.Value;
        
        // Extract realm roles from JSON
        var realmRoles = new List<string>();
        var realmAccessClaim = User.Claims.FirstOrDefault(c => c.Type == "realm_access");
        if (realmAccessClaim != null)
        {
            try
            {
                var realmAccess = JsonSerializer.Deserialize<JsonElement>(realmAccessClaim.Value);
                if (realmAccess.TryGetProperty("roles", out var rolesElement))
                {
                    realmRoles = rolesElement.EnumerateArray()
                        .Select(r => r.GetString() ?? "")
                        .Where(r => !string.IsNullOrEmpty(r))
                        .ToList();
                }
            }
            catch { }
        }
        
        // Extract resource roles from JSON
        var resourceRoles = new Dictionary<string, List<string>>();
        var resourceAccessClaim = User.Claims.FirstOrDefault(c => c.Type == "resource_access");
        if (resourceAccessClaim != null)
        {
            try
            {
                var resourceAccess = JsonSerializer.Deserialize<JsonElement>(resourceAccessClaim.Value);
                foreach (var resource in resourceAccess.EnumerateObject())
                {
                    if (resource.Value.TryGetProperty("roles", out var rolesElement))
                    {
                        resourceRoles[resource.Name] = rolesElement.EnumerateArray()
                            .Select(r => r.GetString() ?? "")
                            .Where(r => !string.IsNullOrEmpty(r))
                            .ToList();
                    }
                }
            }
            catch { }
        }
        
        // Extract groups
        var groups = User.Claims
            .Where(c => c.Type == "groups" || c.Type.EndsWith("/groups"))
            .Select(c => c.Value)
            .ToList();

        return Ok(new { 
            IsAuthenticated = User.Identity?.IsAuthenticated ?? false,
            Name = name,
            Email = email,
            Roles = realmRoles,
            ResourceRoles = resourceRoles,
            Groups = groups,
            Claims = claims
        });
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateCurrentUser([FromBody] UpdateProfileDto profileDto)
    {
        // Try different email claim types
        var email = User.Claims.FirstOrDefault(c => c.Type == "email" || 
                                                     c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" ||
                                                     c.Type.EndsWith("/emailaddress"))?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            return BadRequest(new { 
                message = "Email not found in token",
                availableClaims = User.Claims.Select(c => new { c.Type, c.Value }).ToList()
            });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        
        if (user == null)
        {
            // Create new user if doesn't exist
            user = new User
            {
                Email = email,
                FirstName = profileDto.FirstName,
                LastName = profileDto.LastName,
                CreatedAt = DateTime.UtcNow
            };
            _context.Users.Add(user);
        }
        else
        {
            // Update existing user
            user.FirstName = profileDto.FirstName;
            user.LastName = profileDto.LastName;
        }

        await _context.SaveChangesAsync();
        return Ok(user);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<User>> GetUser(int id)
    {
        var user = await _context.Users.FindAsync(id);

        if (user == null)
        {
            return NotFound();
        }

        return user;
    }

    [HttpPost]
    public async Task<ActionResult<User>> CreateUser(User user)
    {
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(int id, User user)
    {
        if (id != user.Id)
        {
            return BadRequest();
        }

        _context.Entry(user).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!UserExists(id))
            {
                return NotFound();
            }
            throw;
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound();
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private bool UserExists(int id)
    {
        return _context.Users.Any(e => e.Id == id);
    }
}

public record UpdateProfileDto(string FirstName, string LastName);
