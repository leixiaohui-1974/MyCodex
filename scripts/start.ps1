$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$electronCli = Join-Path $workspace "node_modules/electron/cli.js"

if (-not (Test-Path $electronCli)) {
  throw "Electron CLI not found at '$electronCli'. This workspace is missing the electron package."
}

Set-Location $workspace
& node $electronCli "."
exit $LASTEXITCODE
