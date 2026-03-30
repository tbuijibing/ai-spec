# docspec-server end-to-end verification
# Usage: .\scripts\verify.ps1

$BASE = "http://localhost:4000"
$ISSUE_SECRET = if ($env:TOKEN_ISSUE_SECRET) { $env:TOKEN_ISSUE_SECRET } else { "dev-issue-secret-change-in-prod" }

$pass = 0
$fail = 0

function Assert-It($label, $expected, $actual) {
    if ($actual -eq $expected) {
        Write-Host "  PASS  $label" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  FAIL  $label  (expected=$expected got=$actual)" -ForegroundColor Red
        $script:fail++
    }
}

function Get-Token($role) {
    $b = @{ sub = "ci-$role"; role = $role; secret = $ISSUE_SECRET } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE/api/auth/token" -Method Post -ContentType "application/json" -Body $b
    return $r.token
}

function Doc-Get($token, $path) {
    try {
        $r = Invoke-WebRequest -Uri "$BASE/api/docs/$path" -UseBasicParsing `
             -Headers @{ Authorization = "Bearer $token" }
        return [int]$r.StatusCode
    } catch { return [int]$_.Exception.Response.StatusCode }
}

function Doc-Put($token, $path, $content) {
    try {
        $b = @{ content = $content } | ConvertTo-Json
        $r = Invoke-WebRequest -Uri "$BASE/api/docs/$path" -Method Put -UseBasicParsing `
             -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $b
        return [int]$r.StatusCode
    } catch { return [int]$_.Exception.Response.StatusCode }
}

# --- 1. Health ---
Write-Host "`n[1] Health" -ForegroundColor Cyan
$h = Invoke-RestMethod -Uri "$BASE/api/health"
Assert-It "GET /api/health" "ok" $h.status

# --- 2. Token issuance ---
Write-Host "`n[2] Token issuance" -ForegroundColor Cyan
$tokFE  = Get-Token "frontend"
$tokAND = Get-Token "android"
$tokTST = Get-Token "test"
$tokADM = Get-Token "admin"
Assert-It "frontend token issued"  $true ($tokFE.Length  -gt 10)
Assert-It "android token issued"   $true ($tokAND.Length -gt 10)
Assert-It "test token issued"      $true ($tokTST.Length -gt 10)
Assert-It "admin token issued"     $true ($tokADM.Length -gt 10)

# --- 3. File listing isolation ---
Write-Host "`n[3] File listing isolation" -ForegroundColor Cyan
$feFiles  = (Invoke-RestMethod -Uri "$BASE/api/docs" -Headers @{ Authorization = "Bearer $tokFE"  }).files
$andFiles = (Invoke-RestMethod -Uri "$BASE/api/docs" -Headers @{ Authorization = "Bearer $tokAND" }).files
$admFiles = (Invoke-RestMethod -Uri "$BASE/api/docs" -Headers @{ Authorization = "Bearer $tokADM" }).files

Assert-It "frontend sees files"       $true ($feFiles.Count  -gt 0)
Assert-It "android sees files"        $true ($andFiles.Count -gt 0)
Assert-It "admin >= frontend count"   $true ($admFiles.Count -ge $feFiles.Count)

$feWritesAndroid = @($feFiles | Where-Object { $_.path -match "android" -and $_.write -eq $true })
Assert-It "frontend cannot write android" $true ($feWritesAndroid.Count -eq 0)

# --- 4. Single file read permission ---
Write-Host "`n[4] Single file read" -ForegroundColor Cyan
$D = "02-modules/SPEC-201"

# Pre-create test files via admin so they exist for subsequent GET tests
$seed = "# verify seed"
$seedPaths = @(
    "02-modules/SPEC-201/README.md",
    "$D/test/README.md",
    "$D/design/README.md",
    "$D/android/README.md",
    "$D/frontend/README.md"
)
foreach ($sp in $seedPaths) {
    $sb = @{ content = $seed } | ConvertTo-Json
    try {
        Invoke-WebRequest -Uri "$BASE/api/docs/$sp" -Method Put -UseBasicParsing `
            -Headers @{ Authorization = "Bearer $tokADM" } `
            -ContentType "application/json" -Body $sb -ErrorAction Stop | Out-Null
    } catch { Write-Host "  seed $sp skipped: $($_.Exception.Response.StatusCode)" -ForegroundColor DarkGray }
}

# test: can read 02-modules/*/README.md (module overview), cannot read design/
Assert-It "test reads module README.md"     200 (Doc-Get $tokTST "02-modules/SPEC-201/README.md")
Assert-It "test blocked from design/"       403 (Doc-Get $tokTST "$D/design/README.md")

# frontend: can read design/, blocked from android/
Assert-It "frontend reads design/README.md" 200 (Doc-Get $tokFE  "$D/design/README.md")
Assert-It "frontend blocked from android/"  403 (Doc-Get $tokFE  "$D/android/README.md")

# admin: full access
Assert-It "admin reads android/README.md"   200 (Doc-Get $tokADM "$D/android/README.md")

# --- 5. Write permission ---
Write-Host "`n[5] Write permission" -ForegroundColor Cyan
$c = "# verify $(Get-Date -Format 'HH:mm:ss')"

Assert-It "frontend writes frontend/"         200 (Doc-Put $tokFE  "$D/frontend/README.md" $c)
Assert-It "frontend blocked writing android/" 403 (Doc-Put $tokFE  "$D/android/README.md"  $c)
Assert-It "test blocked writing test/"        403 (Doc-Put $tokTST "$D/test/README.md"      $c)

# --- 6. Roles endpoint ---
Write-Host "`n[6] Roles endpoint" -ForegroundColor Cyan
$admRoles = Invoke-RestMethod -Uri "$BASE/api/roles" -Headers @{ Authorization = "Bearer $tokADM" }
$feRoles  = Invoke-RestMethod -Uri "$BASE/api/roles" -Headers @{ Authorization = "Bearer $tokFE"  }
Assert-It "admin sees multiple roles"   $true      ($admRoles.roles.Count -gt 1)
Assert-It "frontend sees only itself"   "frontend" $feRoles.roles[0].name

# --- Summary ---
$total = $pass + $fail
Write-Host ""
Write-Host "========================================"
if ($fail -eq 0) {
    Write-Host "ALL PASS: $pass / $total" -ForegroundColor Green
} else {
    Write-Host "FAILED: $fail / $total   PASSED: $pass / $total" -ForegroundColor Red
}
Write-Host "========================================"
