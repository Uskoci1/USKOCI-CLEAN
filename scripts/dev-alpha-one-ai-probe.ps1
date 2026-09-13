param([switch]$SendOneApprovedRequest)
$ErrorActionPreference='Stop'
if (-not $SendOneApprovedRequest -or $PSVersionTable.PSVersion.Major -lt 7) { throw 'Explicit one-request operation required.' }
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'));$qa=Join-Path $repo 'artifacts/dev-alpha-qa'
$config=Get-Content -LiteralPath (Join-Path $qa 'public-auth-config.json') -Raw|ConvertFrom-Json
if ($config.url -ne 'https://leqcwgzvjsxugfgzdmth.supabase.co') { throw 'Canonical DEV only.' }
$intentFile=Join-Path $qa 'one-ai-intent.json';$proofFile=Join-Path $qa 'one-ai-proof.json'
if (Test-Path -LiteralPath $intentFile) { throw 'Existing AI intent: read same operation; never repeat provider request.' }
$secure=ConvertTo-SecureString -String (Get-Content -LiteralPath (Join-Path $qa 'qa-session.dpapi') -Raw).Trim()
$session=([Net.NetworkCredential]::new('', $secure)).Password|ConvertFrom-Json
$headers=@{apikey=$config.publishableKey;Authorization=('Bearer '+$session.access_token);Accept='application/json'}
$intent=@{openRequestId=[Guid]::NewGuid().ToString();turnRequestId=[Guid]::NewGuid().ToString();startedAt=[DateTime]::UtcNow.ToString('o');automaticProviderRetry=$false;maximumProviderRequests=1;accountId='2e7310cf-1887-4378-8e1d-825566419290'}
$intent|ConvertTo-Json|Set-Content -LiteralPath $intentFile -Encoding utf8NoBOM
$proof=@{intent=$intent;steps=@();providerPostAttempted=$false;publicationAttempted=$false}
function Request-Json([string]$Path,[hashtable]$Body,[int]$Timeout=30) {
 $response=Invoke-WebRequest -Uri ($config.url+$Path) -Method Post -Headers $headers -ContentType 'application/json' -Body ($Body|ConvertTo-Json -Depth 8 -Compress) -SkipHttpErrorCheck -MaximumRedirection 0 -TimeoutSec $Timeout
 return @{status=[int]$response.StatusCode;body=($response.Content|ConvertFrom-Json -AsHashtable)}
}
try {
 $me=Invoke-WebRequest -Uri ($config.url+'/auth/v1/user') -Headers $headers -SkipHttpErrorCheck -MaximumRedirection 0 -TimeoutSec 20
 $user=$me.Content|ConvertFrom-Json
 if ($me.StatusCode -ne 200 -or $user.id -ne $intent.accountId -or -not $user.email_confirmed_at) { throw 'Confirmed real QA session required.' }
 $proof.steps+=@{step='AUTH_GET_USER';status=200;accountId=$user.id;confirmed=$true}
 $opened=Request-Json '/rest/v1/rpc/rpc_ai_open_need_conversation_owned_v2' @{p_client_request_id=$intent.openRequestId}
 $proof.steps+=@{step='OPEN_OWNED_CONVERSATION';result=$opened}
 if ($opened.status -ne 200 -or -not $opened.body.authoritative -or $opened.body.clientRequestId -ne $intent.openRequestId -or $opened.body.conversationId -notmatch '^[0-9a-f-]{36}$') { throw 'Canonical conversation open rejected.' }
 $intent.conversationId=$opened.body.conversationId
 $intent|ConvertTo-Json|Set-Content -LiteralPath $intentFile -Encoding utf8NoBOM
 $proof.providerPostAttempted=$true
 try {
  $reply=Request-Json '/functions/v1/uskoci-ai-interview' @{conversationId=$intent.conversationId;clientRequestId=$intent.turnRequestId;text='TEST / INTERNAL: Potrebna mi je lektura kratkog probnog teksta na srpskom, rad na daljinu, jedan izvršilac, fleksibilan termin i cena po dogovoru.'} 55
  $proof.steps+=@{step='ONE_AI_EDGE_POST';result=$reply}
 } catch { $proof.steps+=@{step='ONE_AI_EDGE_POST';outcome='UNKNOWN_NO_RETRY'} }
 $recovered=Request-Json '/rest/v1/rpc/rpc_ai_recover_need_turn_v2' @{p_conversation_id=$intent.conversationId;p_client_request_id=$intent.turnRequestId}
 $proof.steps+=@{step='SAME_OPERATION_RECOVERY';result=$recovered}
 $proof.outcome='READBACK_RECORDED_REQUIRES_REVIEW'
} catch { $proof.outcome='STOPPED_AT_RECORDED_STEP_NO_RETRY' }
finally {
 $session=$null;$secure=$null;$headers=$null;$me=$null;$user=$null
 $proof.finishedAt=[DateTime]::UtcNow.ToString('o')
 $proof|ConvertTo-Json -Depth 25|Set-Content -LiteralPath $proofFile -Encoding utf8NoBOM
}
$proof|ConvertTo-Json -Depth 25 -Compress
