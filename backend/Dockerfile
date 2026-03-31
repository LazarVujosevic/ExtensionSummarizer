FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["ExtensionSummarizer.API/ExtensionSummarizer.API.csproj", "ExtensionSummarizer.API/"]
RUN dotnet restore "ExtensionSummarizer.API/ExtensionSummarizer.API.csproj"
COPY . .
WORKDIR "/src/ExtensionSummarizer.API"
RUN dotnet build "ExtensionSummarizer.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "ExtensionSummarizer.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ExtensionSummarizer.API.dll"]
