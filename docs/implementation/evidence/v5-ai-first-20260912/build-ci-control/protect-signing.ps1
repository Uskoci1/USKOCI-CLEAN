param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
$signingPlaintext = [Console]::In.ReadToEnd()
if (-not $signingPlaintext) { throw 'No signing payload received.' }
$signingProtected = ConvertTo-SecureString -String $signingPlaintext -AsPlainText -Force
$signingProtected | ConvertFrom-SecureString | Set-Content -LiteralPath $OutputPath -Encoding utf8
$signingPlaintext = $null
