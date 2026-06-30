#!/usr/bin/env bash
# Sync Hermes skill namespaces between local repo and remote server.
#
# Usage:
#   ./sync-hermes-skills.sh push [namespace]   # local → server
#   ./sync-hermes-skills.sh pull [namespace]   # server → local
#
# Namespaces: baizor  jilai  all (default)
#
# Examples:
#   ./sync-hermes-skills.sh push            # push all namespaces
#   ./sync-hermes-skills.sh push baizor     # push only baizor-skills
#   ./sync-hermes-skills.sh pull jilai      # pull only jilai-skills

REMOTE_HOST="${REMOTE_HOST:-baizor-root}"
CONTAINER="${CONTAINER:-baizor-hermes}"
LOCAL_ROOT="$(cd "$(dirname "$0")/hermes-agent" && pwd)"
SSH="ssh -o LogLevel=ERROR"
SCP="scp -o LogLevel=ERROR"

# namespace → local_subdir, remote_path
ns_local()  { case "$1" in baizor) echo "baizor-skills" ;; jilai) echo "optional-skills/jilai-skills" ;; esac; }
ns_remote() { case "$1" in baizor) echo "/opt/data/baizor-skills" ;; jilai) echo "/opt/data/jilai-skills" ;; esac; }

usage() { echo "Usage: $0 push|pull [baizor|jilai|all]"; exit 1; }

push_namespace() {
  local ns="$1"
  local local_path="${LOCAL_ROOT}/$(ns_local "$ns")"
  local remote_path
  remote_path="$(ns_remote "$ns")"
  local tmp="/tmp/hermes-skills-push-$$-${ns}"

  echo "→ push ${ns}: ${local_path} → ${CONTAINER}:${remote_path}"

  if [ ! -d "$local_path" ]; then
    echo "  [skip] local dir not found: ${local_path}"
    return 0
  fi

  # Stream local dir to server via tar pipe (single SSH connection)
  # Use named subdir inside tmp to avoid docker cp path ambiguity
  tar -C "$local_path" -czf - . | $SSH "$REMOTE_HOST" "
    rm -rf ${tmp} && mkdir -p ${tmp}/contents
    tar -xzf - -C ${tmp}/contents
    docker exec ${CONTAINER} mkdir -p ${remote_path}
    docker cp ${tmp}/contents/. ${CONTAINER}:${remote_path}
    rm -rf ${tmp}
  " 2>/dev/null || true
  echo "  [ok] pushed $(find "$local_path" -name 'SKILL.md' | wc -l | tr -d ' ') skills"
}

pull_namespace() {
  local ns="$1"
  local local_path="${LOCAL_ROOT}/$(ns_local "$ns")"
  local remote_path
  remote_path="$(ns_remote "$ns")"
  local tmp="/tmp/hermes-skills-pull-$$-${ns}"

  echo "← pull ${ns}: ${CONTAINER}:${remote_path} → ${local_path}"

  # Single SSH: check + docker cp to tmp + tar to stdout; local side extracts
  mkdir -p "$local_path"
  if ! $SSH "$REMOTE_HOST" "
    if docker exec ${CONTAINER} test -d ${remote_path} 2>/dev/null; then
      rm -rf ${tmp} && docker cp ${CONTAINER}:${remote_path} ${tmp}
      tar -czf - -C ${tmp} .
      rm -rf ${tmp}
    else
      exit 1
    fi
  " 2>/dev/null | tar -xzf - -C "$local_path" 2>/dev/null; then
    echo "  [skip] remote path not found: ${remote_path}"
    return 0
  fi

  echo "  [ok] pulled $(find "$local_path" -name 'SKILL.md' | wc -l | tr -d ' ') skills"
}

# ── main ──────────────────────────────────────────────────────────────────

ACTION="${1:-}"
NS="${2:-all}"

[ -z "$ACTION" ] && usage

case "$NS" in
  all)    NAMESPACES=("baizor" "jilai") ;;
  baizor) NAMESPACES=("baizor") ;;
  jilai)  NAMESPACES=("jilai") ;;
  *)      echo "Unknown namespace: $NS"; usage ;;
esac

case "$ACTION" in
  push)
    for ns in "${NAMESPACES[@]}"; do push_namespace "$ns"; done
    echo "Done. Hermes will pick up changes on next skill reload."
    ;;
  pull)
    for ns in "${NAMESPACES[@]}"; do pull_namespace "$ns"; done
    echo "Done. Local files updated."
    ;;
  *)
    usage
    ;;
esac

