#!/usr/bin/env bash
# Smoke test for the deployed backend.
#
# Hits the golden path: health → login → /auth/me → POST /diary →
# poll until analysis done → start chat → send message → generate report →
# match therapist.
#
# Requires: curl, jq.
# Env vars (mandatory):
#   API_BASE         e.g. https://api.example.com  (or http://localhost:8000)
#   SUPABASE_URL     https://<ref>.supabase.co
#   SUPABASE_ANON_KEY  publishable key (sb_publishable_...)
#   TEST_EMAIL       a real account in your Supabase project
#   TEST_PASSWORD
#
# Usage: chmod +x scripts/smoke.sh && ./scripts/smoke.sh

set -euo pipefail

: "${API_BASE:?set API_BASE}"
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY}"
: "${TEST_EMAIL:?set TEST_EMAIL}"
: "${TEST_PASSWORD:?set TEST_PASSWORD}"

bold()  { printf "\n\033[1m▶ %s\033[0m\n" "$*"; }
ok()    { printf "\033[32m✓ %s\033[0m\n" "$*"; }
fail()  { printf "\033[31m✗ %s\033[0m\n" "$*" >&2; exit 1; }

# ─────────────────────────────────────────
bold "1) /health"
curl -fsS "$API_BASE/health" | jq -e '.status == "ok"' >/dev/null \
  || fail "/health not ok"
ok "backend reachable"

# ─────────────────────────────────────────
bold "2) Supabase login → JWT"
LOGIN=$(curl -fsS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | jq -r '.access_token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || fail "no access_token returned"
ok "got token (${TOKEN:0:20}…)"

AUTH=(-H "Authorization: Bearer $TOKEN")

# ─────────────────────────────────────────
# Idempotency: scrub any leftover diary for today so step 4 doesn't 409.
TODAY=$(date +%Y-%m-%d)
YEAR=$(date +%Y); MONTH=$(date +%-m)
EXISTING=$(curl -fsS "${AUTH[@]}" "$API_BASE/diary?year=$YEAR&month=$MONTH" \
  | jq -r --arg d "$TODAY" '[.[] | select(.entry_date == $d)][0].entry_id // empty')
if [ -n "$EXISTING" ]; then
  curl -fsS -X DELETE "${AUTH[@]}" "$API_BASE/diary/$EXISTING" >/dev/null
  ok "scrubbed leftover diary #$EXISTING for $TODAY"
fi

# ─────────────────────────────────────────
bold "3) GET /auth/me"
ME=$(curl -fsS "${AUTH[@]}" "$API_BASE/auth/me")
USER_ID=$(echo "$ME" | jq -r '.id')
[ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] || fail "no user id"
ok "user_id=$USER_ID"

# ─────────────────────────────────────────
bold "4a) POST /diary/preview  (live, no DB write)"
PREV=$(curl -fsS -X POST "$API_BASE/diary/preview" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{"content":"I felt anxious in the morning but calmer after a walk."}')
PRIMARY=$(echo "$PREV" | jq -r '.primary_emotion')
SCORES=$(echo "$PREV" | jq -c '.scores')
[ -n "$PRIMARY" ] && [ "$PRIMARY" != "null" ] || fail "preview failed: $PREV"
ok "live primary=$PRIMARY scores=$SCORES"

# ─────────────────────────────────────────
bold "4) POST /diary"
DIARY=$(curl -fsS -X POST "$API_BASE/diary" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"entry_date\":\"$TODAY\",\"title\":\"smoke\",\"content\":\"I felt anxious in the morning but calmer after a walk.\"}")
ENTRY_ID=$(echo "$DIARY" | jq -r '.entry_id')
[ -n "$ENTRY_ID" ] && [ "$ENTRY_ID" != "null" ] || fail "diary create failed: $DIARY"
ok "entry_id=$ENTRY_ID"

# ─────────────────────────────────────────
bold "5) Poll GET /diary/$ENTRY_ID until done"
for i in $(seq 1 20); do
  D=$(curl -fsS "${AUTH[@]}" "$API_BASE/diary/$ENTRY_ID")
  STATUS=$(echo "$D" | jq -r '.status')
  printf "  attempt %2d → %s\n" "$i" "$STATUS"
  case "$STATUS" in
    done)   break ;;
    failed) fail "analysis failed: $(echo "$D" | jq -c .)" ;;
  esac
  sleep 1
done
[ "$STATUS" = "done" ] || fail "analysis did not finish within 20s"
PRIMARY=$(echo "$D" | jq -r '.primary_emotion')
SCORES=$(echo "$D" | jq -c '.scores')
ok "primary=$PRIMARY scores=$SCORES"

# ─────────────────────────────────────────
bold "6) POST /conversations"
CONV=$(curl -fsS -X POST "$API_BASE/conversations" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"diary_entry_id\":$ENTRY_ID,\"title\":null}")
CONV_ID=$(echo "$CONV" | jq -r '.id')
[ -n "$CONV_ID" ] && [ "$CONV_ID" != "null" ] || fail "conversation create failed: $CONV"
ok "conversation_id=$CONV_ID"

# ─────────────────────────────────────────
bold "7) POST /conversations/$CONV_ID/messages"
MSG=$(curl -fsS -X POST "$API_BASE/conversations/$CONV_ID/messages" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{"message":"why did I feel anxious this morning?"}')
ASSIST=$(echo "$MSG" | jq -r '.assistant_message.content')
[ -n "$ASSIST" ] && [ "$ASSIST" != "null" ] || fail "no assistant reply: $MSG"
ok "Solis: ${ASSIST:0:80}…"

# ─────────────────────────────────────────
bold "8) POST /reports"
WEEK_AGO=$(date -d "$TODAY -6 days" +%Y-%m-%d 2>/dev/null || date -v -6d +%Y-%m-%d)
REPORT=$(curl -fsS -X POST "$API_BASE/reports" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"period_start\":\"$WEEK_AGO\",\"period_end\":\"$TODAY\"}")
DOMINANT=$(echo "$REPORT" | jq -r '.dominant_emotion')
[ -n "$DOMINANT" ] && [ "$DOMINANT" != "null" ] || fail "report failed: $REPORT"
ok "dominant=$DOMINANT"

# ─────────────────────────────────────────
bold "9) POST /therapist/match"
MATCH=$(curl -fsS -X POST "$API_BASE/therapist/match" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{
    "therapist_summary": {
      "summary_for_therapist": "User reports morning anxiety that eases with movement.",
      "key_concerns": ["anxiety", "workplace stress"],
      "emotion_pattern": "anxiety peaks AM, calms PM",
      "suggested_focus_areas": ["anxiety regulation"],
      "crisis_indicators": "none detected",
      "user_strengths": "self-aware, takes walks"
    },
    "user_emotions": {
      "joy":0.2,"sad":0.1,"anger":0.0,"anxiety":0.7,"calm":0.4,
      "embarrassment":0.0,"envy":0.0,"boredom":0.0,"nostalgia":0.0
    },
    "language": "both"
  }')
TOP=$(echo "$MATCH" | jq -r '.top_matches[0].name // empty')
[ -n "$TOP" ] || fail "no matches: $MATCH"
ok "top match: $TOP"

# ─────────────────────────────────────────
bold "✅ all green"
