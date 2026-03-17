$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$smokeScript = Join-Path $workspace "scripts/smoke.js"

if (-not (Test-Path $smokeScript)) {
  throw "Smoke script not found at '$smokeScript'."
}

Set-Location $workspace
& node $smokeScript
exit $LASTEXITCODE
