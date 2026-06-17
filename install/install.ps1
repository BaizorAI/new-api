# BaizorAi CLI Windows installer
# Usage: irm https://dl.baizor.com/install.ps1 | iex
#
# Environment variables:
#   BAIZORAI_DOWNLOAD_BASE - Base URL for downloads (default: https://dl.baizor.com)
#   BAIZORAI_INSTALL_DIR   - Target directory (default: $env:LOCALAPPDATA\Programs\baizorai)
#   BAIZORAI_VERSION       - Version to install (default: latest), e.g. v5.8.1
#   BAIZORAI_FORCE         - Set to 1 to skip overwrite confirmation
#   BAIZORAI_NO_PATH       - Set to 1 to skip PATH modification

param()

$ErrorActionPreference = 'Stop'

# Force TLS 1.2 for older PowerShell 5.1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$BIN_NAME = 'BaizorAi'

# ── configuration ──────────────────────────────────────────────────────

$DownloadBase = if ($env:BAIZORAI_DOWNLOAD_BASE) { $env:BAIZORAI_DOWNLOAD_BASE.TrimEnd('/') } else { 'https://baizor.com/install' }
$InstallDir = if ($env:BAIZORAI_INSTALL_DIR) { $env:BAIZORAI_INSTALL_DIR } else { "$env:LOCALAPPDATA\Programs\baizorai" }
$Target = Join-Path $InstallDir "$BIN_NAME.exe"
$Version = if ($env:BAIZORAI_VERSION) { $env:BAIZORAI_VERSION } else { 'latest' }
if ($Version -ne 'latest' -and $Version -notmatch '^v') {
    $Version = "v$Version"
}
$Force = ($env:BAIZORAI_FORCE -eq '1')
$NoPath = ($env:BAIZORAI_NO_PATH -eq '1')
$AssetName = 'baizorai-windows-x64.zip'

# ── helpers ────────────────────────────────────────────────────────────

function Write-Info {
    Write-Host '  ' -NoNewline
    Write-Host 'info' -ForegroundColor Green -NoNewline
    Write-Host ': ' -NoNewline
    Write-Host $args
}

function Write-Warn {
    Write-Host '  ' -NoNewline
    Write-Host 'warn' -ForegroundColor Yellow -NoNewline
    Write-Host ': ' -NoNewline
    Write-Host $args
}

function Write-Err {
    Write-Host '  ' -NoNewline
    Write-Host 'error' -ForegroundColor Red -NoNewline
    Write-Host ': ' -NoNewline
    Write-Host $args
}

function Die {
    Write-Err $args
    exit 1
}

function Get-InstalledVersion {
    param([string]$Path)
    if (-not $Path -or -not (Test-Path $Path)) { return $null }
    try {
        $output = & $Path --version 2>$null
        if ($LASTEXITCODE -eq 0 -and $output) {
            return ($output -split "`n")[0].Trim()
        }
    } catch { }
    return $null
}

# ── architecture detection ─────────────────────────────────────────────

function Get-Architecture {
    # Prefer env vars — works on all PowerShell versions (5.1 and 7+)
    if ($env:PROCESSOR_ARCHITEW6432) {
        $arch = $env:PROCESSOR_ARCHITEW6432
    } elseif ($env:PROCESSOR_ARCHITECTURE) {
        $arch = $env:PROCESSOR_ARCHITECTURE
    } else {
        # PowerShell 7+ fallback (.NET Core only)
        try {
            $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
        } catch { }
    }

    if (-not $arch) {
        Die "Could not detect system architecture."
    }

    switch -Wildcard ($arch.ToString().ToLower()) {
        'x64'   { return 'windows-x64' }
        'amd64' { return 'windows-x64' }
        'arm64' { return 'windows-arm64' }
        default {
            Die "Unsupported architecture: $arch. Only x64 Windows is currently supported.`nSee available downloads: $DownloadBase"
        }
    }
}

# ── download & extract ─────────────────────────────────────────────────

function Get-DownloadUrl {
    param([string]$Platform)
    if ($Version -eq 'latest') {
        return "$DownloadBase/baizorai-$Platform.zip"
    } else {
        return "$DownloadBase/baizorai-$Version-$Platform.zip"
    }
}

function Invoke-Download {
    param([string]$Url, [string]$Dest)

    Write-Info "Downloading $AssetName"
    Write-Info "  $Url"
    try {
        Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing
    } catch {
        $statusCode = 0
        try { $statusCode = $_.Exception.Response.StatusCode.value__ } catch { }
        if ($statusCode -eq 404) {
            Die "Release asset not found: $Url`nIf specifying a version, make sure it exists (e.g. v5.8.1)."
        }
        throw
    }
}

function Expand-ArchiveChecked {
    param([string]$Path, [string]$Dest)

    Write-Info "Extracting archive"
    try {
        Expand-Archive -Path $Path -DestinationPath $Dest -Force
    } catch {
        # PowerShell 5.1 fallback: use .NET for older zip files
        try {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [System.IO.Compression.ZipFile]::ExtractToDirectory($Path, $Dest)
        } catch {
            throw
        }
    }

    $exe = Join-Path $Dest "$BIN_NAME.exe"
    if (-not (Test-Path $exe)) {
        Die "Binary '$BIN_NAME.exe' not found in archive."
    }
}

# ── install ────────────────────────────────────────────────────────────

function Invoke-Install {
    $stagedTarget = "$Target.new"

    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    # Atomically stage and replace: rename existing → stage new → cleanup old
    if (Test-Path $Target) {
        try {
            Remove-Item "$Target.old" -Force -ErrorAction SilentlyContinue
            Rename-Item $Target "$Target.old" -ErrorAction Stop
        } catch {
            Write-Warn "Could not rename existing binary (it may be running). Trying to overwrite."
            Remove-Item $Target -Force -ErrorAction SilentlyContinue
        }
    }

    Copy-Item $ExePath $stagedTarget
    Rename-Item $stagedTarget (Split-Path $Target -Leaf)
    # $stagedTarget is now at $Target

    if (Test-Path "$Target.old") {
        Remove-Item "$Target.old" -Force -ErrorAction SilentlyContinue
    }
}

# ── PATH management ────────────────────────────────────────────────────

function Add-ToUserPath {
    if ($NoPath) {
        Write-Info "Skipping PATH modification (BAIZORAI_NO_PATH is set)."
        return
    }

    $currentUserPath = [Environment]::GetEnvironmentVariable('Path', 'User') -split ';' | Where-Object { $_ }

    if ($currentUserPath -contains $InstallDir) {
        return  # already on PATH
    }

    Write-Info "Adding to user PATH"
    $newPath = @($InstallDir) + $currentUserPath
    [Environment]::SetEnvironmentVariable('Path', ($newPath -join ';'), 'User')

    Write-Warn "$InstallDir has been added to your user PATH."
}

function Test-OtherBaizorAiInPath {
    $cmd = Get-Command "$BIN_NAME.exe" -ErrorAction SilentlyContinue
    if (-not $cmd) { return }
    $found = $cmd.Source
    if ($found -and (Resolve-Path $found).Path -ne (Resolve-Path $Target).Path) {
        Write-Warn "$BIN_NAME.exe currently resolves to $found, so $Target may be shadowed."
    }
}

# ── main ───────────────────────────────────────────────────────────────

$TempDir = $null
$ExePath = $null

try {
    # Architecture check
    $Platform = Get-Architecture
    if ($Platform -ne 'windows-x64') {
        Die "Only x64 Windows is currently supported.`nSee available downloads: $DownloadBase"
    }

    # Existing installation check
    if (Test-Path $Target) {
        $installedVer = Get-InstalledVersion $Target
        $msg = "Existing installation detected at $Target"
        if ($installedVer) { $msg += " ($installedVer)" }
        $msg += "."

        if ($Force) {
            Write-Warn "$msg Continuing because BAIZORAI_FORCE=1."
        } else {
            Write-Host "  $msg"
            $reply = Read-Host "  [U]pdate or [C]ancel? [U/c]"
            if ($reply -match '^c' -or $reply -match '^C') {
                Write-Info "Installation canceled."
                exit 0
            }
        }
    }

    # Download
    $TempDir = Join-Path $env:TEMP "BaizorAi-install-$(New-Guid)"
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

    $ZipPath = Join-Path $TempDir $AssetName
    $DownloadUrl = Get-DownloadUrl -Platform $Platform
    Invoke-Download -Url $DownloadUrl -Dest $ZipPath

    # Extract
    $ExtractDir = Join-Path $TempDir 'extract'
    Expand-ArchiveChecked -Path $ZipPath -Dest $ExtractDir
    $ExePath = Join-Path $ExtractDir "$BIN_NAME.exe"

    # Install
    Invoke-Install

    Write-Info "Installed $BIN_NAME to $Target"
    Test-OtherBaizorAiInPath
    Add-ToUserPath

    # Refresh PATH in current session so the command works immediately
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')

    Write-Host ''
    Write-Host "  Run " -NoNewline
    Write-Host "BaizorAi --version" -ForegroundColor Cyan -NoNewline
    Write-Host " to verify."
    Write-Host ''
    Write-Host "  Optional: run " -NoNewline
    Write-Host "BaizorAi completions install --activate" -ForegroundColor Cyan -NoNewline
    Write-Host " to install and activate shell completions."
    Write-Host ''

} catch {
    Write-Err $_.Exception.Message
    Write-Err "  at $($_.InvocationInfo.ScriptName):$($_.InvocationInfo.ScriptLineNumber)"
    Write-Err "  line: $($_.InvocationInfo.Line.Trim())"
    Write-Err "Installation failed."
    Write-Err "If the problem persists, download manually: $DownloadBase"
    exit 1
} finally {
    if ($TempDir -and (Test-Path $TempDir)) {
        Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
    }
}
