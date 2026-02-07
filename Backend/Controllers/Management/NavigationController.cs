using Backend.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Returns the navigation menu filtered by the current user's permissions.
/// The frontend sidebar loads its menu from this endpoint.
/// </summary>
[ApiController]
[Route("api/navigation")]
[Authorize]
public class NavigationController : ControllerBase
{
    private readonly INavigationService _navigationService;
    private readonly ILogger<NavigationController> _logger;

    public NavigationController(
        INavigationService navigationService,
        ILogger<NavigationController> logger)
    {
        _navigationService = navigationService;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/navigation/menu
    /// Returns the navigation menu tree filtered by the current user's permissions.
    /// </summary>
    [HttpGet("menu")]
    public async Task<ActionResult<NavigationMenuResponse>> GetMenu()
    {
        try
        {
            var response = await _navigationService.GetNavigationMenuAsync(User);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error building navigation menu");
            return StatusCode(500, new { error = "Failed to build navigation menu" });
        }
    }
}
