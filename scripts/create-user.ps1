param([string]$Username = 'owner')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$secret = Read-Host 'En az 12 karakterli parola' -AsSecureString
$credential = [System.Net.NetworkCredential]::new('', $secret)
try {
 $env:FIVEISO_NEW_PASSWORD = $credential.Password
 node --env-file-if-exists=.env server/manage.mjs owner $Username
 if ($LASTEXITCODE -ne 0) { throw 'Hesap oluşturulamadı.' }
} finally { Remove-Item Env:FIVEISO_NEW_PASSWORD -ErrorAction SilentlyContinue }
