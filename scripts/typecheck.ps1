$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$tscCli = Join-Path $workspace "node_modules/typescript/bin/tsc"

if (-not (Test-Path $tscCli)) {
  throw "TypeScript CLI not found at '$tscCli'. Reinstall dependencies before typecheck."
}

Set-Location $workspace
& node $tscCli --noEmit
exit $LASTEXITCODE
