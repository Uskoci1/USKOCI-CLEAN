param([Parameter(Mandatory=$true)][string]$RepositoryPath)
$ErrorActionPreference = 'Stop'
$repositoryAbsolute = (Resolve-Path -LiteralPath $RepositoryPath).Path
$androidDirectory = Join-Path $repositoryAbsolute 'android'
$gradleWrapper = Join-Path $androidDirectory 'gradlew.bat'
if (-not (Test-Path -LiteralPath $gradleWrapper)) { throw 'Generate the native Android project before building.' }
$protectedFile = 'C:\Users\user\AppData\Local\USKOCI\build-signing-v5-20260912\existing-team-preview.dpapi'
$encryptedPayload = Get-Content -LiteralPath $protectedFile -Raw
$signingSecureString = ConvertTo-SecureString -String $encryptedPayload.Trim()
$signingPayload = ([System.Net.NetworkCredential]::new('', $signingSecureString)).Password | ConvertFrom-Json
$buildEnvironmentNames = @('USKOCI_ANDROID_STORE_FILE','USKOCI_ANDROID_STORE_PASSWORD','USKOCI_ANDROID_KEY_ALIAS','USKOCI_ANDROID_KEY_PASSWORD','CI','NODE_ENV','EXPO_PUBLIC_USE_FAKE_SOURCE')
$previousEnvironment = @{}
foreach ($environmentName in $buildEnvironmentNames) { $previousEnvironment[$environmentName] = [Environment]::GetEnvironmentVariable($environmentName, 'Process') }
try {
  $env:USKOCI_ANDROID_STORE_FILE = $signingPayload.keystorePath
  $env:USKOCI_ANDROID_STORE_PASSWORD = $signingPayload.keystorePassword
  $env:USKOCI_ANDROID_KEY_ALIAS = $signingPayload.keyAlias
  $env:USKOCI_ANDROID_KEY_PASSWORD = $signingPayload.keyPassword
  $env:CI = '1'
  $env:NODE_ENV = 'production'
  $env:EXPO_PUBLIC_USE_FAKE_SOURCE = '0'
  $signingPayload = $null
  Push-Location -LiteralPath $androidDirectory
  try {
    & $gradleWrapper assembleRelease --no-daemon --max-workers=2
    $buildExitCode = $LASTEXITCODE
  } finally { Pop-Location }
} finally {
  foreach ($environmentName in $buildEnvironmentNames) { [Environment]::SetEnvironmentVariable($environmentName,$previousEnvironment[$environmentName],'Process') }
  $signingPayload = $null
  $signingSecureString = $null
}
exit $buildExitCode
