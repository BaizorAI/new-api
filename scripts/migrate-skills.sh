#!/bin/sh
# One-shot: copy legacy skills into unified skills/ directory.
# Run inside hermes container:  docker exec -u root hermes sh /migrate-skills.sh /opt/data
set -e

DATA_DIR="${1:-/opt/data}"
UNIFIED="$DATA_DIR/skills"
mkdir -p "$UNIFIED"

echo "=== Migrating skills from legacy to unified dir ==="
echo "Data:    $DATA_DIR"
echo "Target:  $UNIFIED"
echo ""

count=0

migrate() {
    src="$1"
    scope="$2"
    oid="$3"
    find "$src" -name 'SKILL.md' -not -path '*/test/*' | while read -r skill_md; do
        skill_dir=$(dirname "$skill_md")
        rel=$(echo "$skill_dir" | sed "s|^${src}/||")
        dst="$UNIFIED/$rel"

        if [ -d "$dst" ]; then
            echo "  SKIP $rel"
            continue
        fi

        mkdir -p "$(dirname "$dst")"
        cp -a "$skill_dir" "$dst"

        if ! grep -q 'owner_id:' "$dst/SKILL.md" 2>/dev/null; then
            sed -i "/hermes:/a\\    owner_id: \"${oid}\"\\n    scope: \"${scope}\"" "$dst/SKILL.md"
        fi
        echo "  OK   $rel ($scope $oid)"
    done
}

# ── Personal skills
for user_dir in "$DATA_DIR"/baizor-users/*/; do
    [ -d "$user_dir" ] || continue
    uid=$(basename "$user_dir")
    src="$user_dir/skills"
    [ -d "$src" ] || continue
    migrate "$src" "user" "$uid"
done

# ── Team skills
for team_dir in "$DATA_DIR"/teams/*/; do
    [ -d "$team_dir" ] || continue
    tid=$(basename "$team_dir")
    [ "$tid" = "0" ] && continue
    src="$team_dir/skills"
    [ -d "$src" ] || continue
    migrate "$src" "team" "$tid"
done

echo ""
echo "=== Done ==="
