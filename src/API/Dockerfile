# syntax=docker/dockerfile:1
# Build context: repository root. Build command (Railway / local):
#   docker build -f src/API/Dockerfile .
#
# Single-container deployment: builds the React SPA and copies it into the
# .NET app's wwwroot, so one origin serves both the API (/api, /swagger,
# /hubs/notifications) and the SPA (/, /assets/*, client routes).

# ── Frontend build stage ─────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY AndritzVendorPortal.Frontend/package.json AndritzVendorPortal.Frontend/package-lock.json ./
RUN npm ci
COPY AndritzVendorPortal.Frontend/ ./
# Production build resolves baseURL to '/api' (same-origin) — no env var needed.
RUN npm run build

# ── Backend build stage ──────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj files first to leverage Docker layer caching for restore
COPY src/Domain/Domain.csproj                     src/Domain/
COPY src/Application/Application.csproj           src/Application/
COPY src/Infrastructure/Infrastructure.csproj     src/Infrastructure/
COPY src/API/API.csproj                           src/API/

RUN dotnet restore "src/API/API.csproj"

# Copy the rest and publish
COPY src/ src/
RUN dotnet publish "src/API/API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
# Drop the SPA build into wwwroot so UseStaticFiles + MapFallbackToFile serve it.
COPY --from=frontend /frontend/dist ./wwwroot

# Railway sets PORT — Program.cs reads it. Default to 8080 for local `docker run`.
ENV PORT=8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "AndritzVendorPortal.API.dll"]
