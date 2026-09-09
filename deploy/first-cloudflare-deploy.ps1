$ErrorActionPreference = "Stop"

Write-Host "Building the Cloudflare Worker..."
& npm.cmd run build:cloudflare
if ($LASTEXITCODE -ne 0) { throw "Cloudflare build failed." }

$secureDatabaseUrl = Read-Host "Paste the Supabase transaction pooler URL (port 6543)" -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureDatabaseUrl)
$databaseUrl = $null
$secretFile = Join-Path ([IO.Path]::GetTempPath()) ("balkanguess-secrets-" + [guid]::NewGuid().ToString("N") + ".json")

try {
  $databaseUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $parsedUrl = $null
  if (-not [Uri]::TryCreate($databaseUrl, [UriKind]::Absolute, [ref]$parsedUrl) -or
      $parsedUrl.Scheme -notin @("postgres", "postgresql") -or
      $parsedUrl.Port -ne 6543) {
    throw "DATABASE_URL must be the complete Supabase transaction pooler URL using port 6543."
  }

  $secretJson = @{ DATABASE_URL = $databaseUrl } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($secretFile, $secretJson, [Text.UTF8Encoding]::new($false))

  Write-Host "Uploading the first Worker version with its database secret..."
  & node node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.json --secrets-file $secretFile
  if ($LASTEXITCODE -ne 0) { throw "Cloudflare deployment failed." }
} finally {
  if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
  $databaseUrl = $null
  if (Test-Path -LiteralPath $secretFile) { Remove-Item -LiteralPath $secretFile -Force }
}
