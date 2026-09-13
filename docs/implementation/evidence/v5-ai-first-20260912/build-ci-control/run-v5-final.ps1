param([Parameter(Mandatory=$true)][string]$StartReceiptPath)
$ErrorActionPreference = 'Stop'
$receiptAbsolute = (Resolve-Path -LiteralPath $StartReceiptPath).Path
if ((Split-Path -Parent $receiptAbsolute) -ne $PSScriptRoot -or
    (Split-Path -Leaf $receiptAbsolute) -notmatch '^build-v5-final-[0-9a-f]{7}-start[.]json$') { throw 'Expected a new final build start receipt.' }
$receipt = Get-Content -LiteralPath $receiptAbsolute -Raw | ConvertFrom-Json
$repositoryAbsolute = (Resolve-Path -LiteralPath $receipt.snapshotPath).Path
if ($repositoryAbsolute -ne 'C:\Users\user\AppData\Local\Temp\u50') { throw 'Unexpected isolated snapshot.' }
$expectedName = 'build-v5-final-' + $receipt.sourceCommit.Substring(0,7) + '-start.json'
if ((Split-Path -Leaf $receiptAbsolute) -ne $expectedName -or $receipt.sourceCommit -notmatch '^[0-9a-f]{40}$' -or
    $receipt.sourceTree -notmatch '^[0-9a-f]{40}$' -or $receipt.result -ne 'PREPARED_NOT_BUILT') { throw 'Invalid or previously consumed source receipt.' }
if ((& git -C $repositoryAbsolute rev-parse HEAD).Trim() -ne $receipt.sourceCommit -or
    (& git -C $repositoryAbsolute rev-parse 'HEAD^{tree}').Trim() -ne $receipt.sourceTree -or
    (& git -C $repositoryAbsolute status --porcelain)) { throw 'Build source must remain exact and clean.' }
foreach ($entry in $receipt.finalBuildHelperPins.PSObject.Properties) {
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot $entry.Name)).Hash.ToLowerInvariant() -ne $entry.Value) { throw 'Prepared build helper changed.' }
}
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$logPath = Join-Path $repositoryRoot ('artifacts\v5-native-smoke\v5-final-' + $receipt.sourceCommit.Substring(0,7) + '-gradle.log')
if (Test-Path -LiteralPath $logPath) { throw 'Existing build log must not be overwritten.' }
$androidDirectory = Join-Path $repositoryAbsolute 'android'
$gradleWrapper = Join-Path $androidDirectory 'gradlew.bat'
$init = Join-Path $repositoryRoot 'artifacts\v5-native-smoke\limit-native-parallelism-exact-source.gradle'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $init).Hash.ToLowerInvariant() -ne '1e4f2b553f35134e1ce3de529622f47ef6ea5c806942c91bef01efb960ff92e3') { throw 'Native task/pool configuration changed.' }
$allowed = @('EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_ANON_KEY','EXPO_PUBLIC_USE_FAKE_SOURCE','EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL')
$publicConfig = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $repositoryAbsolute '.env.local')) {
  if ($line.Trim()) {
    $parts = $line.Split('=',2)
    if ($parts.Length -ne 2 -or $parts[0] -notin $allowed -or $publicConfig.ContainsKey($parts[0])) { throw 'Unexpected or duplicate public build config.' }
    $publicConfig[$parts[0]] = $parts[1]
  }
}
if ($publicConfig.Count -ne 4 -or $publicConfig['EXPO_PUBLIC_USE_FAKE_SOURCE'] -ne '0' -or
    $publicConfig['EXPO_PUBLIC_SUPABASE_URL'] -ne 'https://leqcwgzvjsxugfgzdmth.supabase.co' -or
    $publicConfig['EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL'] -ne 'uskociapp://oporavak') { throw 'Exact canonical four-variable public configuration required.' }
try {
  $parts = $publicConfig['EXPO_PUBLIC_SUPABASE_ANON_KEY'].Split('.')
  if ($parts.Length -ne 3) { throw 'form' }
  $payload = $parts[1].Replace('-','+').Replace('_','/')
  $payload += '=' * ((4 - $payload.Length % 4) % 4)
  $claims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
  if ($claims.role -ne 'anon' -or $claims.ref -ne 'leqcwgzvjsxugfgzdmth') { throw 'role' }
} catch { throw 'Expected the verified canonical public anon key.' }
$protectedFile = 'C:\Users\user\AppData\Local\USKOCI\build-signing-v5-20260912\existing-team-preview.dpapi'
$signingSecureString = ConvertTo-SecureString -String (Get-Content -LiteralPath $protectedFile -Raw).Trim()
$signingPayload = ([System.Net.NetworkCredential]::new('', $signingSecureString)).Password | ConvertFrom-Json
$managed = @('USKOCI_ANDROID_STORE_FILE','USKOCI_ANDROID_STORE_PASSWORD','USKOCI_ANDROID_KEY_ALIAS','USKOCI_ANDROID_KEY_PASSWORD',
  'CI','NODE_ENV','JEST_WORKER_ID','EXPO_NO_DOTENV','JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','CMAKE_BUILD_PARALLEL_LEVEL') + $allowed
$ambient = [Environment]::GetEnvironmentVariables('Process')
$stripped = @($ambient.Keys | Where-Object {
  ($_ -like 'EXPO_PUBLIC_*' -and $_ -notin $allowed) -or
  $_ -match '^(GEMINI_|OPENAI_|ANTHROPIC_|AZURE_OPENAI_|SUPABASE_|GOOGLE_|AI_PROVIDER$)'
})
$managed = @($managed + $stripped | Select-Object -Unique)
$previousEnvironment = @{}
foreach ($name in $managed) { $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
try {
  foreach ($name in $stripped) { [Environment]::SetEnvironmentVariable($name,$null,'Process') }
  $env:USKOCI_ANDROID_STORE_FILE = $signingPayload.keystorePath
  $env:USKOCI_ANDROID_STORE_PASSWORD = $signingPayload.keystorePassword
  $env:USKOCI_ANDROID_KEY_ALIAS = $signingPayload.keyAlias
  $env:USKOCI_ANDROID_KEY_PASSWORD = $signingPayload.keyPassword
  $env:CI = 'false'
  $env:NODE_ENV = 'production'
  $env:EXPO_NO_DOTENV = '1'
  [Environment]::SetEnvironmentVariable('JEST_WORKER_ID',$null,'Process')
  $env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot'
  $env:ANDROID_HOME = 'C:\Users\user\AppData\Local\Android\Sdk'
  $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
  $env:CMAKE_BUILD_PARALLEL_LEVEL = '2'
  foreach ($name in $publicConfig.Keys) { [Environment]::SetEnvironmentVariable($name,$publicConfig[$name],'Process') }
  $publicConfig = $null
  $signingPayload = $null
  Push-Location -LiteralPath $androidDirectory
  try {
    & $gradleWrapper assembleRelease --no-daemon --max-workers=1 --init-script $init *> $logPath
    $buildExitCode = $LASTEXITCODE
  } finally { Pop-Location }
} finally {
  foreach ($name in $managed) { [Environment]::SetEnvironmentVariable($name,$previousEnvironment[$name],'Process') }
  $signingPayload = $null
  $signingSecureString = $null
  $ambient = $null
  $previousEnvironment = $null
}
$body = Get-Content -LiteralPath $logPath -Raw
if ($buildExitCode -eq 0 -and ($body -notmatch 'BUILD SUCCESSFUL' -or $body -match 'BUILD FAILED')) { throw 'Gradle output does not attest full success.' }
$receipt | Add-Member -Force -NotePropertyName fullGradleExitCode -NotePropertyValue $buildExitCode
$receipt | Add-Member -Force -NotePropertyName rawBuildLogSha256 -NotePropertyValue ((Get-FileHash -Algorithm SHA256 -LiteralPath $logPath).Hash.ToLowerInvariant())
$receipt | Add-Member -Force -NotePropertyName localRunnerSha256 -NotePropertyValue ((Get-FileHash -Algorithm SHA256 -LiteralPath $PSCommandPath).Hash.ToLowerInvariant())
$receipt | Add-Member -Force -NotePropertyName environmentStrippingApplied -NotePropertyValue $true
$receipt | Add-Member -Force -NotePropertyName implicitDotenvLoadingDisabled -NotePropertyValue $true
$receipt.result = if ($buildExitCode -eq 0) { 'FULL_BUILD_EXIT_ZERO_PENDING_ATTESTATION' } else { 'FULL_BUILD_FAILED' }
$receipt | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $receiptAbsolute -Encoding utf8
@{result=$receipt.result;sourceCommit=$receipt.sourceCommit;logPath=$logPath;fullGradleExitCode=$buildExitCode} | ConvertTo-Json -Compress
exit $buildExitCode
