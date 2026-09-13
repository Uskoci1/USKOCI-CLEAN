param([switch]$CreateAccount)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
# AF-D20/26: one real, labelled internal QA account in canonical DEV/ALPHA.
# No service key, invented Auth row, credential reset, provider or profile activation.
if (-not $CreateAccount) { throw 'Explicit CreateAccount operation required.' }
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'PowerShell 7 required.' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$qaDirectory = Join-Path $repo 'artifacts/dev-alpha-qa'
$config = Get-Content -LiteralPath (Join-Path $qaDirectory 'public-auth-config.json') -Raw | ConvertFrom-Json
if ($config.projectRef -ne 'leqcwgzvjsxugfgzdmth' -or $config.url -ne 'https://leqcwgzvjsxugfgzdmth.supabase.co' -or
    $config.publishableKey -notmatch '^sb_publishable_[A-Za-z0-9_-]+$' -or
    $config.qaEmail -notmatch '^[A-Za-z0-9.]+\+uskoci-qa@gmail\.com$') { throw 'Canonical QA configuration mismatch.' }
$credentialPath = Join-Path $qaDirectory 'qa-credential.clixml'
$attemptPath = Join-Path $qaDirectory 'signup-attempt.json'
$receiptPath = Join-Path $qaDirectory 'signup-receipt.json'
if ((Test-Path -LiteralPath $credentialPath) -or (Test-Path -LiteralPath $attemptPath)) {
    throw 'Previous preparation or request exists; inspect Auth state before any further request.'
}
$randomBytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
$password = [Convert]::ToBase64String($randomBytes) + '!aA9'
$credential = [PSCredential]::new($config.qaEmail, (ConvertTo-SecureString -String $password -AsPlainText -Force))
# Export-Clixml protects the password using this Windows user's DPAPI identity.
$credential | Export-Clixml -LiteralPath $credentialPath
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = [Security.AccessControl.FileSecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner($sid)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow'))
Set-Acl -LiteralPath $credentialPath -AclObject $acl
@{ projectRef=$config.projectRef; operation='ONE_INTERNAL_QA_SIGNUP'; startedAt=[DateTime]::UtcNow.ToString('o'); automaticRetry=$false } |
    ConvertTo-Json | Set-Content -LiteralPath $attemptPath -Encoding utf8NoBOM
$body = @{ email=$config.qaEmail; password=$password; data=@{
    first_name='USKOCI TEST'; last_name='INTERNAL QA'; full_name='USKOCI TEST INTERNAL QA'; city='Novi Sad'
} } | ConvertTo-Json -Depth 4 -Compress
$receipt = @{ projectRef=$config.projectRef; operation='ONE_INTERNAL_QA_SIGNUP'; actualAuth=$true;
    providerCalls=0; profilesActivated=$false; productionNotifications=$false; automaticRetry=$false }
try {
    $response = Invoke-WebRequest -Uri ($config.url + '/auth/v1/signup') -Method Post -Headers @{ apikey=$config.publishableKey } -ContentType 'application/json' -Body $body -TimeoutSec 25 -MaximumRedirection 0 -SkipHttpErrorCheck
    $result = $response.Content | ConvertFrom-Json -AsHashtable
    $receipt.status = [int]$response.StatusCode
    $userRow = if ($result['user'] -is [Collections.IDictionary]) { $result['user'] } else { $result }
    $receipt.authUserId = $userRow['id']
    $receipt.hasSession = [bool]$result['access_token']
    $receipt.emailConfirmed = [bool]$userRow['email_confirmed_at']
    $receipt.errorCode = $result['error_code']
    $receipt.outcome = if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { 'AUTH_RESPONSE_RECEIVED_READBACK_REQUIRED' } else { 'AUTH_REJECTED_READBACK_REQUIRED' }
} catch {
    $receipt.outcome = 'TRANSPORT_OR_RESPONSE_UNKNOWN_NO_RETRY'
} finally {
    $password=$null; $body=$null; $credential=$null; $result=$null; $response=$null
    [Array]::Clear($randomBytes, 0, $randomBytes.Length)
    $receipt.finishedAt=[DateTime]::UtcNow.ToString('o')
    $receipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $receiptPath -Encoding utf8NoBOM
}
# Only this explicit DTO is printed; never tokens, password, response or exception.
$receipt | ConvertTo-Json -Depth 4 -Compress
