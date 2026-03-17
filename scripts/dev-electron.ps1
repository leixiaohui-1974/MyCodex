$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$waitOnCli = Join-Path $workspace "node_modules/wait-on/bin/wait-on"
$electronCli = Join-Path $workspace "node_modules/electron/cli.js"

if (-not (Test-Path $waitOnCli)) {
  throw "wait-on CLI not found at '$waitOnCli'. Reinstall dependencies before starting Electron."
}

if (-not (Test-Path $electronCli)) {
  throw "Electron CLI not found at '$electronCli'. This workspace is missing the electron package."
}

Set-Location $workspace
& node $waitOnCli "tcp:5173"
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& node $electronCli "."
exit $LASTEXITCODE
