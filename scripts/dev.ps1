$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$waitOnCli = Join-Path $workspace "node_modules/wait-on/bin/wait-on"
$electronCli = Join-Path $workspace "node_modules/electron/cli.js"
$viteCli = Join-Path $workspace "node_modules/vite/dist/node/cli.js"

if (-not (Test-Path $viteCli)) {
  throw "Vite CLI not found at '$viteCli'. Reinstall dependencies before starting dev mode."
}

if (-not (Test-Path $waitOnCli)) {
  throw "wait-on CLI not found at '$waitOnCli'. Reinstall dependencies before starting dev mode."
}

if (-not (Test-Path $electronCli)) {
  throw "Electron CLI not found at '$electronCli'. This workspace is missing the electron package."
}

$viteJob = Start-Job -ScriptBlock {
  param($jobWorkspace, $jobViteCli)
  Set-Location $jobWorkspace
  & node $jobViteCli
} -ArgumentList $workspace, $viteCli

try {
  Set-Location $workspace
  & node $waitOnCli "tcp:5173"
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  & node $electronCli "."
  exit $LASTEXITCODE
}
finally {
  if ($viteJob) {
    Stop-Job -Job $viteJob -ErrorAction SilentlyContinue
    Remove-Job -Job $viteJob -Force -ErrorAction SilentlyContinue
  }
}
