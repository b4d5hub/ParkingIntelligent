param([switch]$Offline)
$ErrorActionPreference = 'Stop'
$serviceRoot = Split-Path $PSScriptRoot -Parent
$containerName = 'tarifs-check-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$names = @('JAVA_HOME','Path','PARKING_INTEGRATION','DB_URL','DB_USER','DB_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$created = $false
try {
    if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath "$env:JAVA_HOME/bin/java.exe")) {
        throw 'Configurer JAVA_HOME vers un JDK 21 avant ce script.'
    }
    $env:Path = "$env:JAVA_HOME/bin;$env:Path"
    & docker run --detach --rm --name $containerName --label parking.owner=tarifs-test -e POSTGRES_DB=parking_test -e POSTGRES_USER=parking_test -e POSTGRES_PASSWORD=isolated_test_only -p 127.0.0.1::5432 --tmpfs /var/lib/postgresql/data postgres:17 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Impossible de créer PostgreSQL de test.' }
    $created = $true
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        & docker exec $containerName pg_isready -U parking_test -d parking_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'PostgreSQL de test ne démarre pas.' }
    Get-Content -LiteralPath "$serviceRoot/src/main/resources/db/tarifs.sql" | & docker exec -i $containerName psql -v ON_ERROR_STOP=1 -U parking_test -d parking_test
    if ($LASTEXITCODE -ne 0) { throw 'Échec du script tarifs.sql' }
    $binding = & docker port $containerName 5432
    if ($binding -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Port PostgreSQL inattendu.' }
    $env:DB_URL = "jdbc:postgresql://127.0.0.1:$($Matches[1])/parking_test"
    $env:DB_USER = 'parking_test'
    $env:DB_PASSWORD = 'isolated_test_only'
    $env:PARKING_INTEGRATION = 'true'
    Push-Location $serviceRoot
    try {
        $arguments = @('-ntp', 'test')
        if ($Offline) { $arguments = @('-o') + $arguments }
        & ./mvnw.cmd @arguments
        if ($LASTEXITCODE -ne 0) { throw 'Les tests ont échoué.' }
    } finally { Pop-Location }
} finally {
    if ($created) {
        $owner = & docker inspect --format '{{ index .Config.Labels "parking.owner" }}' $containerName
        if ($owner -eq 'tarifs-test') { & docker stop $containerName | Out-Null }
    }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}

