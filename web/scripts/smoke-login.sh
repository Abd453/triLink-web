#!/usr/bin/env bash
# Smoke test: log in as each role and validate the response.
# Requires: backend on $API_BASE (default http://localhost:4000),
#           web on $WEB_BASE (default http://localhost:3000).

set -uo pipefail

API_BASE="${API_BASE:-http://localhost:4000}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"

declare -A CREDS=(
  ["admin"]="admin@trilink.edu|Admin@123"
  ["teacher"]="abebe.bekele+t1777047185@demo.trilink.local|Demo@123"
  ["student"]="biniam.getachew+s1777047185@demo.trilink.local|Demo@123"
  ["parent"]="tesfaye.kebede+p1777047185@demo.trilink.local|Demo@123"
)

PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }

echo "Smoke test: ${API_BASE} (api) + ${WEB_BASE} (web)"
echo

# 1. Each /<role>/login page renders 200.
for role in admin teacher student parent; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${WEB_BASE}/${role}/login")
  if [[ "$code" == "200" ]]; then
    echo "  $(green "PASS")  GET ${WEB_BASE}/${role}/login → 200"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL")  GET ${WEB_BASE}/${role}/login → ${code}"
    FAIL=$((FAIL + 1))
  fi
done

# 2. Each role can log in via the API and gets back accessToken + matching role.
for role in "${!CREDS[@]}"; do
  IFS='|' read -r email password <<<"${CREDS[$role]}"
  body=$(curl -s -X POST "${API_BASE}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"role\":\"${role}\"}")
  token=$(echo "$body" | grep -oE '"accessToken":"[^"]+"' | head -1 | cut -d'"' -f4)
  rolesOk=$(echo "$body" | grep -oE "\"role\":\"${role}\"" | head -1)
  if [[ -n "$token" && -n "$rolesOk" ]]; then
    echo "  $(green "PASS")  POST /api/auth/login (${role}) → token + role match"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL")  POST /api/auth/login (${role}) → no token or wrong role"
    echo "    body: ${body}"
    FAIL=$((FAIL + 1))
  fi
done

# 3. Token from admin login can call /api/auth/me (any authenticated endpoint).
admin_email=$(echo "${CREDS[admin]}" | cut -d'|' -f1)
admin_password=$(echo "${CREDS[admin]}" | cut -d'|' -f2)
token=$(curl -s -X POST "${API_BASE}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${admin_email}\",\"password\":\"${admin_password}\",\"role\":\"admin\"}" \
  | grep -oE '"accessToken":"[^"]+"' | head -1 | cut -d'"' -f4)
if [[ -n "$token" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${token}" "${API_BASE}/api/auth/me")
  if [[ "$code" == "200" ]]; then
    echo "  $(green "PASS")  GET /api/auth/me with admin token → 200"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL")  GET /api/auth/me with admin token → ${code}"
    FAIL=$((FAIL + 1))
  fi
fi

echo
if [[ "$FAIL" -eq 0 ]]; then
  echo "$(green "All ${PASS} checks passed.")"
  exit 0
else
  echo "$(red "${FAIL} failing, ${PASS} passing.")"
  exit 1
fi
