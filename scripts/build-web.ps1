$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$viteCli = Join-Path $workspace "node_modules/vite/dist/node/cli.js"

if (-not (Test-Path $viteCli)) {
  throw "Vite CLI not found at '$viteCli'. Reinstall dependencies before building."
}

Set-Location $workspace
& node $viteCli build
exit $LASTEXITCODE
