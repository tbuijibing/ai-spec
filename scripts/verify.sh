#!/bin/bash
# docspec-server end-to-end verification
# Usage: ./scripts/verify.sh

BASE="http://localhost:4000"
ISSUE_SECRET="${TOKEN_ISSUE_SECRET:-dev-issue-secret-change-in-prod}"

pass=0
fail=0

assert_it() {
    local label="$1"
    local expected="$2"
    local actual="$3"
    if [ "$actual" = "$expected" ]; then
        echo -e "\033[0;32m  PASS  $label\033[0m"
        ((pass++))
    else
        echo -e "\033[0;31m  FAIL  $label (expected=$expected got=$actual)\033[0m"
        ((fail++))
    fi
}

get_token() {
    local role="$1"
    local body="{\"sub\":\"ci-$role\",\"role\":\"$role\",\"secret\":\"$ISSUE_SECRET\"}"
    local response=$(curl -sf -X POST "$BASE/api/auth/token" \
        -H "Content-Type: application/json" \
        -d "$body")
    echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

doc_get() {
    local token="$1"
    local path="$2"
    local status=$(curl -sf -o /dev/null -w "%{http_code}" \
        "$BASE/api/docs/$path" \
        -H "Authorization: Bearer $token")
    echo "$status"
}

doc_put() {
    local token="$1"
    local path="$2"
    local content="$3"
    local body="{\"content\":$content}"
    local status=$(curl -sf -o /dev/null -w "%{http_code}" \
        -X PUT "$BASE/api/docs/$path" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "$body")
    echo "$status"
}

# --- 1. Health ---
echo -e "\n\033[0;36m[1] Health\033[0m"
health=$(curl -sf "$BASE/api/health")
health_status=$(echo "$health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
assert_it "GET /api/health" "ok" "$health_status"

# --- 2. Token issuance ---
echo -e "\n\033[0;36m[2] Token issuance\033[0m"
tokFE=$(get_token "frontend")
tokAND=$(get_token "android")
tokTST=$(get_token "test")
tokADM=$(get_token "admin")

assert_it "frontend token issued" "true" "$([ ${#tokFE} -gt 10 ] && echo true || echo false)"
assert_it "android token issued" "true" "$([ ${#tokAND} -gt 10 ] && echo true || echo false)"
assert_it "test token issued" "true" "$([ ${#tokTST} -gt 10 ] && echo true || echo false)"
assert_it "admin token issued" "true" "$([ ${#tokADM} -gt 10 ] && echo true || echo false)"

# --- 3. File listing isolation ---
echo -e "\n\033[0;36m[3] File listing isolation\033[0m"
feFiles=$(curl -sf "$BASE/api/docs" -H "Authorization: Bearer $tokFE")
andFiles=$(curl -sf "$BASE/api/docs" -H "Authorization: Bearer $tokAND")
admFiles=$(curl -sf "$BASE/api/docs" -H "Authorization: Bearer $tokADM")

feCount=$(echo "$feFiles" | grep -o '"path"' | wc -l)
andCount=$(echo "$andFiles" | grep -o '"path"' | wc -l)
admCount=$(echo "$admFiles" | grep -o '"path"' | wc -l)

assert_it "frontend sees files" "true" "$([ $feCount -gt 0 ] && echo true || echo false)"
assert_it "android sees files" "true" "$([ $andCount -gt 0 ] && echo true || echo false)"
assert_it "admin >= frontend count" "true" "$([ $admCount -ge $feCount ] && echo true || echo false)"

# --- 4. Single file read permission ---
echo -e "\n\033[0;36m[4] Single file read\033[0m"
D="02-modules/SPEC-201"

# Pre-create test files via admin
seed="# verify seed"
seedPaths=(
    "02-modules/SPEC-201/README.md"
    "$D/test/README.md"
    "$D/design/README.md"
    "$D/android/README.md"
    "$D/frontend/README.md"
)
for sp in "${seedPaths[@]}"; do
    curl -sf -X PUT "$BASE/api/docs/$sp" \
        -H "Authorization: Bearer $tokADM" \
        -H "Content-Type: application/json" \
        -d "{\"content\":\"$seed\"}" > /dev/null 2>&1 || true
done

# test: can read module README, cannot read design/
assert_it "test reads module README.md" "200" "$(doc_get $tokTST "02-modules/SPEC-201/README.md")"
assert_it "test blocked from design/" "403" "$(doc_get $tokTST "$D/design/README.md")"

# frontend: can read design/, blocked from android/
assert_it "frontend reads design/README.md" "200" "$(doc_get $tokFE "$D/design/README.md")"
assert_it "frontend blocked from android/" "403" "$(doc_get $tokFE "$D/android/README.md")"

# admin: full access
assert_it "admin reads android/README.md" "200" "$(doc_get $tokADM "$D/android/README.md")"

# --- 5. Write permission ---
echo -e "\n\033[0;36m[5] Write permission\033[0m"
c="# verify $(date '+%H:%M:%S')"

assert_it "frontend writes frontend/" "200" "$(doc_put $tokFE "$D/frontend/README.md" "\"$c\"")"
assert_it "frontend blocked writing android/" "403" "$(doc_put $tokFE "$D/android/README.md" "\"$c\"")"
assert_it "test blocked writing test/" "403" "$(doc_put $tokTST "$D/test/README.md" "\"$c\"")"

# --- 6. Roles endpoint ---
echo -e "\n\033[0;36m[6] Roles endpoint\033[0m"
admRoles=$(curl -sf "$BASE/api/roles" -H "Authorization: Bearer $tokADM")
feRoles=$(curl -sf "$BASE/api/roles" -H "Authorization: Bearer $tokFE")

admRolesCount=$(echo "$admRoles" | grep -o '"name"' | wc -l)
feFirstRole=$(echo "$feRoles" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)

assert_it "admin sees multiple roles" "true" "$([ $admRolesCount -gt 1 ] && echo true || echo false)"
assert_it "frontend sees only itself" "frontend" "$feFirstRole"

# --- Summary ---
total=$((pass + fail))
echo ""
echo "========================================"
if [ $fail -eq 0 ]; then
    echo -e "\033[0;32mALL PASS: $pass / $total\033[0m"
else
    echo -e "\033[0;31mFAILED: $fail / $total   PASSED: $pass / $total\033[0m"
fi
echo "========================================"

exit $fail
