# syntax=docker/dockerfile:1
# Build context: repository root. Build command (Railway / local):
#   docker build -f src/API/Dockerfile .
#
# Single-container deployment: one origin serves the API (/api, /swagger,
# /hubs/notifications) and the SPA (/, /assets/*, client routes).
#
# The SPA is built by the API.csproj's BuildFrontend + CopyFrontendDist
# MSBuild targets, which fire automatically on `dotnet publish -c Release`.
# Node is therefore required in the build image (alongside the .NET SDK).

# ── Build stage ──────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

# Install Node 20 alongside the .NET SDK so the MSBuild targets can run
# `npm ci && npm run build` during `dotnet publish`.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Copy csproj files first to leverage Docker layer caching for restore
COPY src/Domain/Domain.csproj                     src/Domain/
COPY src/Application/Application.csproj           src/Application/
COPY src/Infrastructure/Infrastructure.csproj     src/Infrastructure/
COPY src/API/API.csproj                           src/API/

RUN dotnet restore "src/API/API.csproj"

# Copy the rest (.NET sources + frontend) and publish.
# `dotnet publish -c Release` invokes the BuildFrontend (npm ci + npm run build)
# and CopyFrontendDist (dist/ → publish/wwwroot/) MSBuild targets.
COPY src/ src/
COPY AndritzVendorPortal.Frontend/ AndritzVendorPortal.Frontend/

RUN dotnet publish "src/API/API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Railway sets PORT — Program.cs reads it. Default to 8080 for local `docker run`.
ENV PORT=8080
ENV ASPNETCORE_ENVIRONMENT=Production
# appsettings.json carries the office-IIS template defaults (PathBase=/SOT).
# Railway serves at the root of its domain, so explicitly zero PathBase here
# instead of relying on a Railway-dashboard env var. Empty string passes the
# IsNullOrWhiteSpace check in Program.cs, so UsePathBase is skipped.
ENV App__PathBase=""
EXPOSE 8080
ENTRYPOINT ["dotnet", "AndritzVendorPortal.API.dll"]
