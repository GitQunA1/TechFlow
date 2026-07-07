using System.Text;
using MinimalAPIs.Data;
using MinimalAPIs.Endpoints;
using MinimalAPIs.Hubs;
using MinimalAPIs.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

// CORS — allow Next.js dev server to communicate with the API and SignalR hub
builder.Services.AddCors(options =>
{
    options.AddPolicy("NextJsDev", policy =>
        policy
            .WithOrigins("http://localhost:10115", "http://172.29.127.250:10115", "http://technical.vfr.net.vn:10115")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key is missing.");
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateIssuer = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwtSection["Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddSignalR();
builder.Services.AddScoped<NotificationBroadcaster>();
builder.Services.AddHostedService<DeadlineCheckWorker>();



builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT token as: Bearer {your token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
var webRootPath = app.Environment.WebRootPath;
if (string.IsNullOrWhiteSpace(webRootPath))
{
    webRootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
}
if (!Directory.Exists(webRootPath))
{
    Directory.CreateDirectory(webRootPath);
}

var provider = new FileExtensionContentTypeProvider();
provider.Mappings[".dwg"] = "application/acad"; // Hoặc "image/vnd.dwg"

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webRootPath),
    ContentTypeProvider = provider,
    OnPrepareResponse = ctx =>
    {
        // Cho phép frontend tải trực tiếp hoặc view tuỳ file extension
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
    }
});

// Enable CORS before auth middleware
app.UseCors("NextJsDev");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapAuthEndpoints(builder.Configuration);
app.MapDepartmentsEndpoints();
app.MapCategoryEndpoints();
app.MapFolderEndpoints();
app.MapFileEndpoints();
app.MapNotificationEndpoints();
app.MapWorkspaceEndpoints();
app.MapAdminEndpoints();
// SignalR hub — no auth required, clients connect via anonymous WebSocket
app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();
