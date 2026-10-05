#Requires -Version 5.1
<#
.SYNOPSIS
    Prepara y arranca Paradise Kiss en local (Windows): backend Django + frontend Angular.

.DESCRIPTION
    Ejecutar desde la carpeta del proyecto:

        powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1

    El script:
      1. Actualiza la rama actual desde GitHub (git pull --rebase --autostash).
      2. Busca Python 3.12+ y crea o actualiza el entorno virtual .venv.
      3. Revisa backend\.env (datos de Supabase, DJANGO_DEBUG, codificacion del archivo).
      4. Verifica Django y la conexion con la base de Supabase.
      5. Revisa Node.js e instala las dependencias de npm si hace falta.
      6. Abre el backend (puerto 8000) y el frontend (puerto 4200) en ventanas nuevas.

.PARAMETER SkipGitSync
    No actualiza la rama desde GitHub.

.PARAMETER NoBrowser
    No abre el navegador al terminar.
#>
[CmdletBinding()]
param(
    [switch]$SkipGitSync,
    [switch]$NoBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$EnvFile = Join-Path $Backend '.env'
$EnvExample = Join-Path $Backend '.env.example'
$ManagePy = Join-Path $Backend 'manage.py'
$Requirements = Join-Path $Backend 'requirements.txt'
$VenvDir = Join-Path $Root '.venv'
$VenvPython = Join-Path $VenvDir 'Scripts\python.exe'
$PackageLock = Join-Path $Root 'package-lock.json'
$NodeModules = Join-Path $Root 'node_modules'
$BackendUrl = 'http://127.0.0.1:8000/auth/session/'
$FrontendUrl = 'http://localhost:4200/'

function Write-Step([string]$Message) {
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "    OK  $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "    !!  $Message" -ForegroundColor Yellow
}

function Stop-WithError([string]$Message) {
    Write-Host ''
    Write-Host "ERROR: $Message" -ForegroundColor Red
    Write-Host ''
    exit 1
}

# Runs a native program and stops the script when it fails.
function Invoke-Native([string]$FilePath, [string[]]$Arguments, [string]$ErrorMessage) {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError $ErrorMessage
    }
}

# Runs a native program and returns its output without failing on stderr.
function Get-NativeOutput([string]$FilePath, [string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $FilePath @Arguments 2>$null
        return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = @($output) }
    } catch {
        return [pscustomobject]@{ ExitCode = 1; Output = @() }
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Get-FirstLine([string]$FilePath, [string[]]$Arguments) {
    $result = Get-NativeOutput $FilePath $Arguments
    if ($result.ExitCode -ne 0 -or $result.Output.Count -eq 0) {
        return ''
    }
    return "$($result.Output[0])".Trim()
}

function Get-PythonVersion([string]$Executable, [string[]]$Extra) {
    if (-not (Get-Command $Executable -ErrorAction SilentlyContinue)) {
        return $null
    }
    $line = Get-FirstLine $Executable ($Extra + @('-c', 'import sys; print(sys.version_info[0], sys.version_info[1])'))
    $parts = $line -split '\s+'
    if ($parts.Count -ne 2) {
        return $null
    }
    return [version]"$($parts[0]).$($parts[1])"
}

function Get-ListeningProcess([int]$Port) {
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    } catch {
        return $null
    }
    if (-not $connection) {
        return $null
    }
    return Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
}

function Confirm-PortFree([int]$Port, [string]$Name) {
    $process = Get-ListeningProcess $Port
    if (-not $process) {
        return
    }
    Write-Warn "El puerto $Port ya esta ocupado por '$($process.ProcessName)' (PID $($process.Id)). Puede ser un $Name viejo."
    $answer = Read-Host "    Cerrar ese proceso para arrancar el $Name actualizado? [s/N]"
    if ($answer -notmatch '^[sSyY]') {
        Stop-WithError "Cierra la ventana que usa el puerto $Port y vuelve a ejecutar el script."
    }
    Stop-Process -Id $process.Id -Force
    Start-Sleep -Seconds 2
    Write-Ok "Proceso $($process.Id) cerrado."
}

function Start-ServiceWindow([string]$Title, [string]$WorkingDirectory, [string]$Command) {
    $directory = $WorkingDirectory.Replace("'", "''")
    $script = "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location -LiteralPath '$directory'; $Command"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    $shell = (Get-Process -Id $PID).Path
    Start-Process -FilePath $shell -ArgumentList "-NoExit -ExecutionPolicy Bypass -EncodedCommand $encoded" | Out-Null
}

function Wait-ForUrl([string]$Url, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            # Todavia no responde.
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

Set-Location -LiteralPath $Root
Write-Host 'Paradise Kiss - arranque local' -ForegroundColor Magenta
Write-Host "Carpeta: $Root"

# 1. Git ---------------------------------------------------------------------
if ($SkipGitSync) {
    Write-Step 'Actualizacion desde GitHub omitida (-SkipGitSync)'
} else {
    Write-Step 'Actualizando la rama desde GitHub'
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Stop-WithError 'git no esta instalado. Instala Git for Windows desde https://git-scm.com y vuelve a abrir PowerShell.'
    }

    $branch = Get-FirstLine 'git' @('rev-parse', '--abbrev-ref', 'HEAD')
    if (-not $branch) {
        Stop-WithError "La carpeta $Root no es un repositorio git. Ejecuta el script desde el proyecto clonado."
    }
    Invoke-Native 'git' @('fetch', 'origin', '--quiet') 'No se pudo conectar con GitHub (git fetch). Revisa internet y tu sesion de GitHub.'

    $remoteBranch = Get-NativeOutput 'git' @('rev-parse', '--verify', '--quiet', "origin/$branch")
    if ($remoteBranch.ExitCode -ne 0) {
        Write-Warn "La rama '$branch' no existe en GitHub; se usa la copia local."
    } else {
        $counts = (Get-FirstLine 'git' @('rev-list', '--left-right', '--count', "HEAD...origin/$branch")) -split '\s+'
        $ahead = [int]$counts[0]
        $behind = [int]$counts[1]

        if ($behind -eq 0) {
            Write-Ok "Rama '$branch' al dia."
        } else {
            if ($ahead -gt 0) {
                # Tras reescribir el historial en GitHub, un "git pull" normal mezclaria
                # los commits viejos. Con --rebase, git descarta los que ya estan en
                # GitHub y solo reaplica los commits propios de esta compu.
                Write-Warn "Tu copia y GitHub se separaron ($ahead commit(s) locales, $behind nuevos en GitHub)."
                Write-Warn 'Se reaplican tus commits locales encima de GitHub; los que ya estan alli se omiten.'
            }
            & git pull --rebase --autostash origin $branch
            if ($LASTEXITCODE -ne 0) {
                $null = Get-NativeOutput 'git' @('rebase', '--abort')
                Stop-WithError "No se pudo actualizar '$branch' automaticamente (hay conflictos). Pide ayuda a Diego antes de seguir; tus cambios no se perdieron."
            }
            Write-Ok "Rama '$branch' actualizada."
        }
    }
}

# 2. Python y entorno virtual ------------------------------------------------
Write-Step 'Revisando Python y el entorno virtual (.venv)'
$minimumPython = [version]'3.12'

if (Test-Path -LiteralPath $VenvPython) {
    $venvVersion = Get-PythonVersion $VenvPython @()
    if (-not $venvVersion -or $venvVersion -lt $minimumPython) {
        Write-Warn "El .venv existente usa Python $venvVersion (hace falta 3.12+). Se vuelve a crear."
        try {
            Remove-Item -LiteralPath $VenvDir -Recurse -Force
        } catch {
            Stop-WithError 'No se pudo borrar .venv. Cierra VS Code y otras terminales que usen ese Python y vuelve a intentarlo.'
        }
    }
}

if (-not (Test-Path -LiteralPath $VenvPython)) {
    $candidates = @(
        @('py', '-3.13'), @('py', '-3.12'), @('py', '-3.14'), @('py', '-3'),
        @('python'), @('python3')
    )
    $basePython = $null
    foreach ($candidate in $candidates) {
        $extra = @()
        if ($candidate.Count -gt 1) {
            $extra = @($candidate[1..($candidate.Count - 1)])
        }
        $version = Get-PythonVersion $candidate[0] $extra
        if ($version -and $version -ge $minimumPython) {
            $basePython = @{ Executable = $candidate[0]; Extra = $extra; Version = $version }
            break
        }
    }
    if (-not $basePython) {
        Stop-WithError 'No se encontro Python 3.12 o superior. Instalalo desde https://www.python.org/downloads/ (marca "Add python.exe to PATH") y vuelve a abrir PowerShell.'
    }
    Write-Ok "Python $($basePython.Version) encontrado. Creando .venv..."
    Invoke-Native $basePython.Executable ($basePython.Extra + @('-m', 'venv', $VenvDir)) 'No se pudo crear el entorno virtual .venv.'
}

$requirementsStamp = Join-Path $VenvDir '.requirements.sha256'
$requirementsHash = (Get-FileHash -LiteralPath $Requirements -Algorithm SHA256).Hash
$installedHash = ''
if (Test-Path -LiteralPath $requirementsStamp) {
    $installedHash = (Get-Content -LiteralPath $requirementsStamp -Raw).Trim()
}
if ($installedHash -ne $requirementsHash) {
    Write-Ok 'Instalando dependencias del backend...'
    Invoke-Native $VenvPython @('-m', 'pip', 'install', '--disable-pip-version-check', '-r', $Requirements) 'pip no pudo instalar backend\requirements.txt.'
    Set-Content -LiteralPath $requirementsStamp -Value $requirementsHash -Encoding ASCII
}
Write-Ok "Entorno listo (Python $(Get-PythonVersion $VenvPython @()))."

# 3. backend\.env ------------------------------------------------------------
Write-Step 'Revisando backend\.env'
if (-not (Test-Path -LiteralPath $EnvFile)) {
    Copy-Item -LiteralPath $EnvExample -Destination $EnvFile
    Stop-WithError 'Se creo backend\.env a partir de .env.example. Pidele a Diego por privado DJANGO_SECRET_KEY y DB_PASSWORD, pegalos en backend\.env y vuelve a ejecutar el script.'
}

# Notepad suele guardar con BOM o en UTF-16; Django no leeria bien la primera linea.
$bytes = [IO.File]::ReadAllBytes($EnvFile)
$hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) -or
          ($bytes.Length -ge 2 -and (($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) -or ($bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF)))
if ($hasBom) {
    $lines = Get-Content -LiteralPath $EnvFile
    [IO.File]::WriteAllLines($EnvFile, [string[]]$lines, (New-Object Text.UTF8Encoding $false))
    Write-Warn 'backend\.env estaba guardado con BOM/UTF-16 (Notepad). Se convirtio a UTF-8 sin BOM.'
}

$envValues = @{}
foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        $envValues[$Matches[1]] = $Matches[2].Trim('"', "'")
    }
}

function Get-EnvValue([string]$Name) {
    if ($envValues.ContainsKey($Name)) {
        return $envValues[$Name]
    }
    return ''
}

$placeholder = 'ASK_PROJECT_OWNER|REPLACE_WITH|replace-with'
$secretKey = Get-EnvValue 'DJANGO_SECRET_KEY'
if ($secretKey -match $placeholder) {
    Stop-WithError 'DJANGO_SECRET_KEY en backend\.env sigue con el valor de ejemplo. Pide el valor real a Diego por privado.'
}
if (-not $secretKey) {
    Write-Warn 'Falta DJANGO_SECRET_KEY en backend\.env. En local funciona, pero pide el valor compartido a Diego.'
}

if ((Get-EnvValue 'DJANGO_USE_SQLITE') -eq 'true') {
    Write-Warn 'DJANGO_USE_SQLITE=true: se usaria una base SQLite vacia sin usuarios. Ponlo en false para usar Supabase.'
}

if (-not (Get-EnvValue 'DATABASE_URL')) {
    $missing = @('DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST') | Where-Object { -not (Get-EnvValue $_) }
    if ($missing) {
        Stop-WithError "Faltan en backend\.env: $($missing -join ', '). Copia los valores de backend\.env.example y pide DB_PASSWORD a Diego."
    }
    if ((Get-EnvValue 'DB_PASSWORD') -match $placeholder) {
        Stop-WithError 'DB_PASSWORD en backend\.env sigue con el valor de ejemplo. Pide la clave real de Supabase a Diego por privado.'
    }
}

# Las variables de entorno de Windows tienen prioridad sobre backend\.env.
foreach ($name in @('DJANGO_USE_SQLITE', 'DATABASE_URL', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DJANGO_SECRET_KEY')) {
    $processValue = [Environment]::GetEnvironmentVariable($name)
    if ($null -ne $processValue -and $processValue -ne (Get-EnvValue $name)) {
        Write-Warn "La variable de Windows $name pisaba el valor de backend\.env; se ignora en esta sesion."
        Remove-Item -LiteralPath "Env:$name"
    }
}

# Sin DEBUG, Django redirige todo a HTTPS y en local no responde.
if ((Get-EnvValue 'DJANGO_DEBUG') -ne 'true') {
    Write-Warn 'DJANGO_DEBUG no es true en backend\.env; se activa para esta sesion local.'
}
$env:DJANGO_DEBUG = 'true'
Write-Ok 'backend\.env correcto.'

# 4. Django y Supabase -------------------------------------------------------
Write-Step 'Verificando Django y la conexion con Supabase'
Invoke-Native $VenvPython @($ManagePy, 'check') 'Django encontro errores en el codigo (ver arriba). Avisa a Diego.'
Invoke-Native $VenvPython @($ManagePy, 'check_team_setup') 'No hay conexion con la base de Supabase. Revisa DB_PASSWORD y DB_HOST en backend\.env y tu conexion a internet.'

$migrationPlan = Get-NativeOutput $VenvPython @($ManagePy, 'showmigrations', '--plan')
$pending = @($migrationPlan.Output | Where-Object { "$_" -match '^\s*\[ \]' })
if ($pending.Count -gt 0) {
    Write-Warn "Hay $($pending.Count) migracion(es) sin aplicar en Supabase. No se aplican automaticamente porque la base es compartida; avisa a Diego."
}

# 5. Node.js y npm -----------------------------------------------------------
Write-Step 'Revisando Node.js y las dependencias del frontend'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Stop-WithError 'Node.js no esta instalado. Instala Node 24 LTS desde https://nodejs.org y vuelve a abrir PowerShell.'
}
$nodeVersionText = (Get-FirstLine 'node' @('--version')).TrimStart('v').Split('-')[0]
$nodeVersion = [version]$nodeVersionText
$nodeSupported = ($nodeVersion.Major -eq 22 -and $nodeVersion -ge [version]'22.22.3') -or
                 ($nodeVersion.Major -eq 24 -and $nodeVersion -ge [version]'24.15.0') -or
                 ($nodeVersion.Major -ge 26)
if (-not $nodeSupported) {
    Stop-WithError "Node $nodeVersion no es compatible con Angular 22. Instala Node 24 LTS (24.15.0 o mas nuevo) desde https://nodejs.org."
}
Write-Ok "Node $nodeVersion."

$npmStamp = Join-Path $NodeModules '.paradise-kiss-lock.sha256'
$lockHash = (Get-FileHash -LiteralPath $PackageLock -Algorithm SHA256).Hash
$installedLock = ''
if (Test-Path -LiteralPath $npmStamp) {
    $installedLock = (Get-Content -LiteralPath $npmStamp -Raw).Trim()
}
if ($installedLock -ne $lockHash) {
    Confirm-PortFree 4200 'frontend'
    Write-Ok 'Instalando dependencias del frontend (npm ci)...'
    Invoke-Native 'npm.cmd' @('ci', '--no-audit', '--no-fund') 'npm ci fallo. Cierra ventanas de "ng serve" abiertas y vuelve a intentarlo.'
    Set-Content -LiteralPath $npmStamp -Value $lockHash -Encoding ASCII
}
Write-Ok 'Dependencias del frontend listas.'

# 6. Arranque ----------------------------------------------------------------
Write-Step 'Arrancando backend y frontend'
Confirm-PortFree 8000 'backend'
Confirm-PortFree 4200 'frontend'

$python = $VenvPython.Replace("'", "''")
$manage = $ManagePy.Replace("'", "''")
Start-ServiceWindow 'Paradise Kiss - backend :8000' $Backend "`$env:DJANGO_DEBUG = 'true'; & '$python' '$manage' runserver 127.0.0.1:8000"
if (-not (Wait-ForUrl $BackendUrl 60)) {
    Stop-WithError 'El backend no respondio en http://127.0.0.1:8000. Mira el error en la ventana "Paradise Kiss - backend".'
}
Write-Ok 'Backend en http://127.0.0.1:8000'

Start-ServiceWindow 'Paradise Kiss - frontend :4200' $Root 'npm.cmd start'
Write-Host '    ..  Compilando el frontend (la primera vez puede tardar un par de minutos)...'
if (-not (Wait-ForUrl $FrontendUrl 240)) {
    Stop-WithError 'El frontend no respondio en http://localhost:4200. Mira el error en la ventana "Paradise Kiss - frontend".'
}
Write-Ok "Frontend en $FrontendUrl"

if (-not $NoBrowser) {
    Start-Process $FrontendUrl
}

Write-Host ''
Write-Host 'Listo. Inicia sesion con tu usuario (sosa.diego, friedrich.nico o tebben.fabian).' -ForegroundColor Green
Write-Host 'Para parar todo, cierra las dos ventanas "Paradise Kiss - backend" y "Paradise Kiss - frontend".'
