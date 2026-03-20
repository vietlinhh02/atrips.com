#!/bin/bash
set -euo pipefail

###############################################################################
# ATrips AI Pipeline Benchmark
# Tự động test tất cả model combinations, so sánh speed + quality.
# Usage: bash scripts/benchmark-pipeline.sh
###############################################################################

API_URL="http://localhost:5000"
PROXY_URL="http://localhost:8317"
PROXY_KEY="proxypal-local"
EMAIL="dangstudio@gmail.com"
PASSWORD="Sauchiatay04!"
ENV_FILE=".env"
RESULTS_FILE="logs/benchmark-$(date +%Y%m%d-%H%M%S).json"

# ── Models to test ──────────────────────────────────────────────────────────
FAST_MODELS=(
  "kiro-claude-haiku-4-5"
  "kiro-minimax-m2-1"
  "claude-haiku-4-5"
)

SYNTH_MODELS=(
  "kiro-claude-sonnet-4-5"
  "kiro-minimax-m2-5"
  "kiro-claude-sonnet-4"
  "kiro-deepseek-3-2"
  "claude-sonnet-4-5"
  "kiro-qwen3-coder-next"
)

# ── Test queries ────────────────────────────────────────────────────────────
declare -A QUERIES
QUERIES[danang]="Lập kế hoạch du lịch Đà Nẵng 3 ngày cho 2 người, ngân sách 10 triệu, thích biển và ẩm thực, từ 1 đến 3 tháng 4 2026"
QUERIES[tokyo]="Plan a 5-day trip to Tokyo Japan for 4 people, budget \$3000, interested in anime and temples, from May 1 to May 5 2026"
QUERIES[hoian]="Plan 2 days in Hoi An Vietnam for couple, budget \$500, love food and history, March 25-26 2026"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

# ── Helper functions ────────────────────────────────────────────────────────

login() {
  local token
  token=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    -c - 2>/dev/null | grep access_token | awk '{print $NF}')
  echo "$token"
}

check_model_available() {
  local model=$1
  local status
  status=$(curl -s -X POST "$PROXY_URL/v1/chat/completions" \
    -H "Authorization: Bearer $PROXY_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"max_tokens\":5}" \
    --max-time 15 2>/dev/null | python3 -c "
import sys,json
try:
  d=json.loads(sys.stdin.read())
  if d.get('choices'): print('ok')
  else: print('fail')
except: print('fail')
" 2>/dev/null)
  [[ "$status" == "ok" ]]
}

update_env() {
  local key=$1 value=$2
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

restart_server() {
  local pid
  pid=$(pgrep -f "node.*src/index" 2>/dev/null | head -1 || true)
  if [[ -n "$pid" ]]; then
    kill -SIGTERM "$pid" 2>/dev/null || true
    sleep 2
  fi
  npm run dev &>/dev/null &
  # Wait for server
  for i in $(seq 1 30); do
    if curl -s "$API_URL/api/health" &>/dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "Server failed to start" >&2
  return 1
}

run_plan_test() {
  local token=$1 query=$2 label=$3
  local encoded_query
  encoded_query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))")

  local start_ms end_ms duration_ms
  local draft_id=""
  local events=""
  local worker_ok=0 worker_fail=0
  local has_content=false has_draft=false

  start_ms=$(date +%s%3N)

  while IFS= read -r line; do
    if [[ "$line" == data:* ]]; then
      local data="${line#data: }"
      local type
      type=$(echo "$data" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('type',''))" 2>/dev/null || true)

      case "$type" in
        worker_completed) ((worker_ok++)) ;;
        worker_failed) ((worker_fail++)) ;;
        draft_created)
          has_draft=true
          draft_id=$(echo "$data" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('draftId',''))" 2>/dev/null || true)
          ;;
        content) has_content=true ;;
        done) break ;;
      esac
    fi
  done < <(curl -sN -b "access_token=$token" \
    "$API_URL/api/ai/chat/stream?message=$encoded_query" \
    --max-time 300 2>/dev/null)

  end_ms=$(date +%s%3N)
  duration_ms=$((end_ms - start_ms))

  # Check draft quality
  local num_days=0 total_acts=0 acts_with_coords=0
  local acts_with_time=0 acts_with_cost=0
  local title="" destination=""

  if [[ -n "$draft_id" && "$draft_id" != "none" ]]; then
    eval "$(curl -s -b "access_token=$token" \
      "$API_URL/api/ai/drafts/$draft_id" 2>/dev/null | python3 -c "
import sys, json
try:
  d = json.loads(sys.stdin.read())
  draft = d.get('data', {}).get('draft', {})
  data = draft.get('generatedData', {})
  trip = data.get('trip', {})
  days = data.get('days', [])
  title = trip.get('title', 'N/A').replace(\"'\", \"\")
  dest = trip.get('destination', 'N/A').replace(\"'\", \"\")

  total = 0; coords = 0; times = 0; costs = 0
  for day in days:
    for a in day.get('activities', []):
      total += 1
      if a.get('latitude') and a.get('longitude'): coords += 1
      if a.get('time'): times += 1
      if a.get('estimatedCost') is not None: costs += 1

  print(f\"num_days={len(days)}\")
  print(f\"total_acts={total}\")
  print(f\"acts_with_coords={coords}\")
  print(f\"acts_with_time={times}\")
  print(f\"acts_with_cost={costs}\")
  print(f\"title='{title}'\")
  print(f\"destination='{dest}'\")
except Exception as e:
  print(f'num_days=0')
  print(f'total_acts=0')
  print(f'acts_with_coords=0')
  print(f'acts_with_time=0')
  print(f'acts_with_cost=0')
  print(f\"title=error\")
  print(f\"destination=error\")
" 2>/dev/null)"
  fi

  # Quality score (0-100)
  local quality=0
  if [[ $total_acts -gt 0 ]]; then
    local coord_pct=$((acts_with_coords * 100 / total_acts))
    local time_pct=$((acts_with_time * 100 / total_acts))
    local cost_pct=$((acts_with_cost * 100 / total_acts))
    local acts_per_day=0
    if [[ $num_days -gt 0 ]]; then
      acts_per_day=$((total_acts / num_days))
    fi
    # Score: coords(30) + time(20) + cost(20) + has_draft(15) + acts_density(15)
    local draft_score=0; [[ "$has_draft" == "true" ]] && draft_score=15
    local density_score=0
    if [[ $acts_per_day -ge 4 ]]; then density_score=15
    elif [[ $acts_per_day -ge 3 ]]; then density_score=10
    elif [[ $acts_per_day -ge 2 ]]; then density_score=5
    fi
    quality=$((coord_pct * 30 / 100 + time_pct * 20 / 100 + cost_pct * 20 / 100 + draft_score + density_score))
  fi

  # Output result
  echo "{\"label\":\"$label\",\"duration_ms\":$duration_ms,\"workers_ok\":$worker_ok,\"workers_fail\":$worker_fail,\"has_draft\":$has_draft,\"draft_id\":\"$draft_id\",\"num_days\":$num_days,\"total_activities\":$total_acts,\"coords\":$acts_with_coords,\"times\":$acts_with_time,\"costs\":$acts_with_cost,\"quality_score\":$quality,\"title\":\"$title\"}"
}

get_pipeline_timing() {
  local log_file="logs/app-$(date +%Y-%m-%d).log"
  tail -30 "$log_file" 2>/dev/null | grep "\[Pipeline\] Total pipeline" | tail -1 | \
    python3 -c "import sys,json,re; line=sys.stdin.read(); m=re.search(r'durationMs.:(\d+)', line); print(m.group(1) if m else '0')" 2>/dev/null
}

# ── Main ────────────────────────────────────────────────────────────────────

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ATrips AI Pipeline Benchmark                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Login
echo -e "${CYAN}[1/5] Logging in...${NC}"
TOKEN=$(login)
if [[ -z "$TOKEN" ]]; then
  echo -e "${RED}Login failed${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ Logged in${NC}"

# Check available models
echo -e "${CYAN}[2/5] Checking available models...${NC}"
AVAILABLE_FAST=()
AVAILABLE_SYNTH=()

for m in "${FAST_MODELS[@]}"; do
  if check_model_available "$m"; then
    AVAILABLE_FAST+=("$m")
    echo -e "${GREEN}  ✓ $m${NC}"
  else
    echo -e "${RED}  ✗ $m (unavailable)${NC}"
  fi
done

for m in "${SYNTH_MODELS[@]}"; do
  if check_model_available "$m"; then
    AVAILABLE_SYNTH+=("$m")
    echo -e "${GREEN}  ✓ $m${NC}"
  else
    echo -e "${RED}  ✗ $m (unavailable)${NC}"
  fi
done

echo ""
echo -e "${CYAN}[3/5] Running benchmarks...${NC}"
echo -e "  Fast models: ${#AVAILABLE_FAST[@]} | Synth models: ${#AVAILABLE_SYNTH[@]}"
echo -e "  Test queries: ${#QUERIES[@]}"
echo -e "  Total combinations: $((${#AVAILABLE_FAST[@]} * ${#AVAILABLE_SYNTH[@]} * ${#QUERIES[@]}))"
echo ""

# Save original env
ORIG_FAST=$(grep "^OAI_FAST_MODEL=" "$ENV_FILE" | cut -d= -f2)
ORIG_SYNTH=$(grep "^OAI_SYNTHESIS_MODEL=" "$ENV_FILE" | cut -d= -f2)

ALL_RESULTS="["
first=true

for fast_model in "${AVAILABLE_FAST[@]}"; do
  for synth_model in "${AVAILABLE_SYNTH[@]}"; do
    combo="${fast_model} + ${synth_model}"
    echo -e "${YELLOW}━━━ Testing: $combo ━━━${NC}"

    # Update env and restart
    update_env "OAI_FAST_MODEL" "$fast_model"
    update_env "OAI_SYNTHESIS_MODEL" "$synth_model"

    if ! restart_server; then
      echo -e "${RED}  Server failed, skipping${NC}"
      continue
    fi

    # Re-login after restart
    TOKEN=$(login)
    if [[ -z "$TOKEN" ]]; then
      echo -e "${RED}  Login failed after restart, skipping${NC}"
      continue
    fi

    for query_key in "${!QUERIES[@]}"; do
      query="${QUERIES[$query_key]}"
      label="${fast_model}|${synth_model}|${query_key}"

      echo -ne "  ${query_key}... "

      result=$(run_plan_test "$TOKEN" "$query" "$label")
      duration=$(echo "$result" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('duration_ms',0))" 2>/dev/null)
      quality=$(echo "$result" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('quality_score',0))" 2>/dev/null)
      acts=$(echo "$result" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('total_activities',0))" 2>/dev/null)
      pipeline_ms=$(get_pipeline_timing)

      # Color based on quality
      if [[ $quality -ge 80 ]]; then
        echo -e "${GREEN}${duration}ms | pipeline:${pipeline_ms}ms | quality:${quality}/100 | ${acts} activities ✓${NC}"
      elif [[ $quality -ge 50 ]]; then
        echo -e "${YELLOW}${duration}ms | pipeline:${pipeline_ms}ms | quality:${quality}/100 | ${acts} activities${NC}"
      else
        echo -e "${RED}${duration}ms | pipeline:${pipeline_ms}ms | quality:${quality}/100 | ${acts} activities ✗${NC}"
      fi

      # Append to results
      enriched=$(echo "$result" | python3 -c "
import sys,json
d=json.loads(sys.stdin.read())
d['fast_model']='$fast_model'
d['synth_model']='$synth_model'
d['query_key']='$query_key'
d['pipeline_ms']=$pipeline_ms
print(json.dumps(d))
" 2>/dev/null)

      if [[ "$first" == "true" ]]; then
        ALL_RESULTS+="$enriched"
        first=false
      else
        ALL_RESULTS+=",$enriched"
      fi

      sleep 2
    done
    echo ""
  done
done

ALL_RESULTS+="]"

# Restore original env
update_env "OAI_FAST_MODEL" "$ORIG_FAST"
update_env "OAI_SYNTHESIS_MODEL" "$ORIG_SYNTH"
restart_server

# Save results
mkdir -p logs
echo "$ALL_RESULTS" | python3 -m json.tool > "$RESULTS_FILE" 2>/dev/null || echo "$ALL_RESULTS" > "$RESULTS_FILE"

echo -e "${CYAN}[4/5] Results saved to ${RESULTS_FILE}${NC}"

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  BENCHMARK SUMMARY                                     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"

echo "$ALL_RESULTS" | python3 -c "
import sys, json

results = json.loads(sys.stdin.read())
if not results:
    print('No results')
    sys.exit()

# Group by model combo
combos = {}
for r in results:
    key = f\"{r['fast_model']} + {r['synth_model']}\"
    if key not in combos:
        combos[key] = []
    combos[key].append(r)

print()
print(f\"{'Model Combination':<55} {'Avg Time':>8} {'Avg Quality':>11} {'Success':>8}\")
print('─' * 85)

best_combo = None
best_score = -1

for combo, runs in sorted(combos.items()):
    avg_time = sum(r['duration_ms'] for r in runs) / len(runs)
    avg_quality = sum(r['quality_score'] for r in runs) / len(runs)
    success = sum(1 for r in runs if r['has_draft']) / len(runs) * 100
    avg_pipeline = sum(r.get('pipeline_ms', 0) for r in runs) / len(runs)

    # Composite score: quality(60%) + speed(40%) - lower time is better
    speed_score = max(0, 100 - avg_time / 1000)  # 100s = 0, 0s = 100
    composite = avg_quality * 0.6 + speed_score * 0.4

    if composite > best_score:
        best_score = composite
        best_combo = combo

    q_color = '\033[0;32m' if avg_quality >= 80 else '\033[1;33m' if avg_quality >= 50 else '\033[0;31m'
    print(f\"  {combo:<53} {avg_time/1000:>6.1f}s  {q_color}{avg_quality:>9.0f}/100\033[0m  {success:>6.0f}%\")

print()
if best_combo:
    print(f\"\033[0;32m  ★ BEST: {best_combo}\033[0m\")
    print(f\"    (highest composite score: quality×60% + speed×40%)\")
print()

# Per-query breakdown for best combo
if best_combo:
    print(f\"  Details for best combo:\")
    for r in combos[best_combo]:
        print(f\"    {r['query_key']:<10} {r['duration_ms']/1000:.1f}s  quality:{r['quality_score']}/100  acts:{r['total_activities']}  days:{r['num_days']}\")
" 2>/dev/null

echo ""
echo -e "${CYAN}[5/5] Benchmark complete. Results: ${RESULTS_FILE}${NC}"
echo -e "${YELLOW}  To apply best config: edit .env with recommended OAI_FAST_MODEL + OAI_SYNTHESIS_MODEL${NC}"
