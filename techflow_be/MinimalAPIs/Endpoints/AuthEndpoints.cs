using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;
using MinimalAPIs.Contracts.Common;
using MinimalAPIs.Contracts.Auth;
using MinimalAPIs.Data;
using MinimalAPIs.Domain.Entities;
using MinimalAPIs.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace MinimalAPIs.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app, IConfiguration configuration)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", (RegisterRequest request, AppDbContext dbContext, CancellationToken cancellationToken) =>
            RegisterAsync(request, dbContext, cancellationToken))
            .RequireAuthorization(new AuthorizeAttribute { Roles = nameof(UserRole.Admin) });
        group.MapPost("/login", (LoginRequest request, AppDbContext dbContext, CancellationToken cancellationToken) =>
            LoginAsync(request, dbContext, configuration, cancellationToken));

        return app;
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest("Username and password are required.");
        }

        var existingUser = await dbContext.Users.AnyAsync(x => x.Username == request.Username, cancellationToken);
        if (existingUser)
        {
            return Results.Conflict("Username already exists.");
        }

        var user = new User
        {
            Username = request.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role,
            CategoryId = request.CategoryId,
            DepartmentId = request.DepartmentId
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new MessageResponse("Success"));
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        AppDbContext dbContext,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Username == request.Username, cancellationToken);
        if (user is null)
        {
            return Results.Unauthorized();
        }

        // Support both BCrypt-hashed passwords (new users) and legacy plain-text passwords
        // (existing seeded users). Plain-text passwords are auto-upgraded on login.
        var passwordValid = user.PasswordHash.StartsWith("$2")
            ? BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash)
            : user.PasswordHash == request.Password;

        if (!passwordValid)
        {
            return Results.Unauthorized();
        }

        // Auto-upgrade plain-text password to BCrypt hash on successful login
        if (!user.PasswordHash.StartsWith("$2"))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var token = CreateToken(user, configuration);

        return Results.Ok(new LoginResponse(
            Token: token,
            UserId: user.Id,
            Role: user.Role.ToString(),
            CategoryId: user.CategoryId,
            DepartmentId: user.DepartmentId));
    }

    private static string CreateToken(User user, IConfiguration configuration)
    {
        var jwtSection = configuration.GetSection("Jwt");
        var key = jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key is missing.");
        var expiresMinutes = int.TryParse(jwtSection["ExpiresMinutes"], out var value) ? value : 240;

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role.ToString())
        };

        if (user.DepartmentId.HasValue)
        {
            claims.Add(new Claim("departmentId", user.DepartmentId.Value.ToString()));
        }

        if (user.CategoryId.HasValue)
        {
            claims.Add(new Claim("categoryId", user.CategoryId.Value.ToString()));
        }

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}