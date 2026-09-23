$ErrorActionPreference = 'Stop'
node (Join-Path $PSScriptRoot 'stitch-map.mjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
