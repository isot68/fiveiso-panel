param([Parameter(Mandatory=$true)][string]$ServerConfig, [Parameter(Mandatory=$true)][string]$Resources)
$ErrorActionPreference = 'Stop'
$cfgPath = (Resolve-Path -LiteralPath $ServerConfig).Path
$resourcesPath = (Resolve-Path -LiteralPath $Resources).Path
$packagePath = Join-Path $PSScriptRoot 'fiveiso'
$targetPath = Join-Path $resourcesPath 'fiveiso'
if (!(Test-Path -LiteralPath $cfgPath -PathType Leaf) -or !(Test-Path -LiteralPath $resourcesPath -PathType Container)) { throw 'Dosya yolları geçersiz.' }
if ($targetPath -eq $packagePath) { throw 'Paketi resources dışında açın.' }
$backupPath = Join-Path (Split-Path $cfgPath) ('.fiveiso-backup-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backupPath | Out-Null
Copy-Item -LiteralPath $cfgPath -Destination (Join-Path $backupPath 'server.cfg')
if (Test-Path -LiteralPath $targetPath) { Move-Item -LiteralPath $targetPath -Destination (Join-Path $backupPath 'fiveiso') }
Copy-Item -LiteralPath $packagePath -Destination $targetPath -Recurse
$previousConfig = Join-Path $backupPath 'fiveiso/database-config.lua'
if (Test-Path -LiteralPath $previousConfig) { Copy-Item -LiteralPath $previousConfig -Destination (Join-Path $targetPath 'database-config.lua') -Force }
$content = [IO.File]::ReadAllText($cfgPath)
$addition = "`r`n# FiveISO kurulumu`r`n"
if ($content -notmatch '(?m)^\s*add_ace\s+resource\.fiveiso\s+command\s+allow(?:\s|$)') { $addition += "add_ace resource.fiveiso command allow`r`n" }
if ($content -notmatch '(?m)^\s*(?:ensure|start)\s+fiveiso(?:\s|$)') { $addition += "ensure fiveiso`r`n" }
[IO.File]::AppendAllText($cfgPath, $addition, [Text.UTF8Encoding]::new($false))
Write-Host "Kuruldu. Yedek: $backupPath"
Write-Host 'FiveM konsolunda: ensure fiveiso'
