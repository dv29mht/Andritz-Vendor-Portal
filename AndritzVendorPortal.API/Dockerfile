# 1. Use the .NET 8 SDK to build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# 2. Copy the project file directly from the current directory (.)
# Render's Root Directory setting already puts us inside the API folder.
COPY AndritzVendorPortal.API.csproj .
RUN dotnet restore "AndritzVendorPortal.API.csproj"

# 3. Copy everything else in the current folder and build
COPY . .
RUN dotnet build "AndritzVendorPortal.API.csproj" -c Release -o /app/build

# 4. Publish the application
FROM build AS publish
RUN dotnet publish "AndritzVendorPortal.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 5. Final runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:10000
EXPOSE 10000
ENTRYPOINT ["dotnet", "AndritzVendorPortal.API.dll"]