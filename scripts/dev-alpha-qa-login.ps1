param([switch]$Login)
$ErrorActionPreference='Stop'
if (-not $Login -or $PSVersionTable.PSVersion.Major -lt 7) { throw 'Explicit PowerShell7 QA login required.' }
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$qa=Join-Path $repo 'artifacts/dev-alpha-qa'
$config=Get-Content -LiteralPath (Join-Path $qa 'public-auth-config.json') -Raw | ConvertFrom-Json
$credential=Import-Clixml -LiteralPath (Join-Path $qa 'qa-credential.clixml')
if ($config.url -ne 'https://leqcwgzvjsxugfgzdmth.supabase.co' -or $credential.UserName -ne 'msljivic031+uskoci-qa@gmail.com') { throw 'Canonical QA identity mismatch.' }
$sessionFile=Join-Path $qa 'qa-session.dpapi'
$attempt=Join-Path $qa 'login-attempt.json'
if ((Test-Path -LiteralPath $attempt) -or (Test-Path -LiteralPath $sessionFile)) { throw 'Existing login attempt; inspect receipt, no blind retry.' }
@{startedAt=[DateTime]::UtcNow.ToString('o');operation='ONE_REAL_QA_PASSWORD_LOGIN'} | ConvertTo-Json | Set-Content -LiteralPath $attempt -Encoding utf8NoBOM
$receipt=@{operation='ONE_REAL_QA_PASSWORD_LOGIN';providerCalls=0;automaticRetry=$false}
try {
 $body=@{email=$credential.UserName;password=$credential.GetNetworkCredential().Password}|ConvertTo-Json -Compress
 $response=Invoke-WebRequest -Uri ($config.url+'/auth/v1/token?grant_type=password') -Method Post -Headers @{apikey=$config.publishableKey} -ContentType 'application/json' -Body $body -SkipHttpErrorCheck -MaximumRedirection 0 -TimeoutSec 25
 $result=$response.Content|ConvertFrom-Json -AsHashtable
 $receipt.status=[int]$response.StatusCode
 if ($response.StatusCode -eq 200 -and $result.user.id -eq '2e7310cf-1887-4378-8e1d-825566419290' -and $result.access_token -and $result.refresh_token) {
  $secure=ConvertTo-SecureString -String ($result|ConvertTo-Json -Depth 15 -Compress) -AsPlainText -Force
  ConvertFrom-SecureString -SecureString $secure | Set-Content -LiteralPath $sessionFile -Encoding utf8NoBOM
  Set-Acl -LiteralPath $sessionFile -AclObject (Get-Acl -LiteralPath (Join-Path $qa 'qa-credential.clixml'))
  $receipt.outcome='AUTHENTICATED_REAL_QA';$receipt.accountId=$result.user.id;$receipt.emailConfirmed=[bool]$result.user.email_confirmed_at
 } else { $receipt.outcome='LOGIN_REJECTED';$receipt.errorCode=$result['error_code'] }
} catch { $receipt.outcome='LOGIN_OUTCOME_UNKNOWN_NO_RETRY' }
finally {
 $credential=$null;$body=$null;$response=$null;$result=$null;$secure=$null
 $receipt.finishedAt=[DateTime]::UtcNow.ToString('o')
 $receipt|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $qa 'login-receipt.json') -Encoding utf8NoBOM
}
$receipt|ConvertTo-Json -Compress
