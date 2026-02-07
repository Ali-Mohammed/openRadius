using Backend.DTOs;
using System.Security.Claims;

namespace Backend.Services;

/// <summary>
/// Service responsible for building the navigation menu tree
/// filtered by the current user's permissions.
/// </summary>
public interface INavigationService
{
    /// <summary>
    /// Gets the navigation menu filtered by the current user's permissions.
    /// </summary>
    /// <param name="user">The ClaimsPrincipal of the current user</param>
    /// <returns>Navigation response with filtered menu and permission list</returns>
    Task<NavigationMenuResponse> GetNavigationMenuAsync(ClaimsPrincipal user);
}
