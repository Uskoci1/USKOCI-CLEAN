<#
.SYNOPSIS
  Run the authenticated DEV/ALPHA AI acceptance with the locally stored QA credential.

.DESCRIPTION
  Decrypts the DPAPI credential written by set_dev_qa_password.ps1, hands it to the Node
  harness through an environment variable of this process only, and clears it afterwards.
  The password is never printed, never passed on a command line and never written anywhere.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\acceptance\run_dev_acceptance.ps1 -Scenarios worker -MaxProviderCalls 6
#>
param(
  [ValidateSet('both', 'worker', 'need')] [string]$Scenarios = 'both',
  [ValidateRange(1, 20)] [int]$MaxProviderCalls = 12
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo  = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$store = Join-Path $repo 'artifacts\dev-alpha-qa'
$credentialFile = Join-Path $store 'qa-credential.clixml'
if (-not (Test-Path -LiteralPath $credentialFile)) {
  throw 'No QA credential store. Run scripts\acceptance\set_dev_qa_password.ps1 -RotateQaPassword first.'
}
$config = Get-Content -LiteralPath (Join-Path $store 'public-auth-config.json') -Raw | ConvertFrom-Json
if ($config.url -ne 'https://leqcwgzvjsxugfgzdmth.supabase.co') { throw 'Credential store points at a different project.' }

$code = 1
$credential = Import-Clixml -LiteralPath $credentialFile
try {
  $env:DEV_ACCEPTANCE_EMAIL = $credential.UserName
  $env:DEV_ACCEPTANCE_PASSWORD = $credential.GetNetworkCredential().Password
  $env:DEV_ACCEPTANCE_URL = $config.url
  $env:DEV_ACCEPTANCE_PUBLISHABLE_KEY = $config.publishableKey
  $env:DEV_ACCEPTANCE_SCENARIOS = $Scenarios
  $env:DEV_ACCEPTANCE_MAX_PROVIDER_CALLS = [string]$MaxProviderCalls
  $env:DEV_ACCEPTANCE_OUT = Join-Path $repo 'artifacts\dev-acceptance'
  Push-Location $repo
  try { & node scripts/acceptance/dev_ai_acceptance.mjs; $code = $LASTEXITCODE } finally { Pop-Location }
}
finally {
  $credential = $null
  Remove-Item Env:DEV_ACCEPTANCE_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:DEV_ACCEPTANCE_EMAIL -ErrorAction SilentlyContinue
  [GC]::Collect()
}
exit $code
