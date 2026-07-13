#!/usr/bin/env bash
# migrate-skills-to-unified.sh — move legacy per-user / per-team skills
# into the unified /opt/data/skills/ directory and add ownership metadata.
set -e

HERMES_DATA="${HERMES_DATA:-/opt/data}"
UNIFIED="${HERMES_DATA}/skills"

echo "=== Migrating legacy skills to unified directory ==="
echo "Unified dir: ${UNIFIED}"

# ── Personal skills (baizor-users/{id}/skills/) ────────────────────────

for user_dir in "${HERMES_DATA}/baizor-users/"*; do
    [ -d "$user_dir" ] || continue
    skills_dir="${user_dir}/skills"
    [ -d "$skills_dir" ] || continue

    user_id="$(basename "$user_dir")"
    echo "  Personal skills — user ${user_id}"

    for skill_md in $(find "$skills_dir" -name 'SKILL.md' -not -path '*/test/SKILL.md'); do
        skill_dir="$(dirname "$skill_md")"
        skill_name="$(basename "$skill_dir")"
        rel="$(echo "$skill_dir" | sed "s|^${skills_dir}/||")"

        # Determine target: flatten category directories
        target_dir="${UNIFIED}/${rel}"
        mkdir -p "$(dirname "$target_dir")"

        if [ -e "$target_dir" ]; then
            echo "    SKIP ${rel} — already exists in unified dir"
            continue
        fi

        echo "    MOVE ${rel} — user ${user_id}"
        cp -a "$skill_dir" "$target_dir"

        # Add ownership metadata to the copy
        sed -i "/metadata:/{
          :a; n; /hermes:/{
            /owner_id:/!s|hermes:|hermes:\n    owner_id: \"${user_id}\"\n    scope: \"user\"|m
            :b; n; /^[[:space:]]/b b
          };
          /hermes:/!s|hermes:|\n  hermes:\n    owner_id: \"${user_id}\"\n    scope: \"user\"|m
        }" "${target_dir}/SKILL.md" 2>/dev/null || true
    done
done

# ── Team skills (teams/{id}/skills/) ────────────────────────────────────

for team_dir in "${HERMES_DATA}/teams/"*; do
    [ -d "$team_dir" ] || continue
    team_id="$(basename "$team_dir")"
    [ "$team_id" = "0" ] && continue

    skills_dir="${team_dir}/skills"
    [ -d "$skills_dir" ] || continue

    echo "  Team skills — team ${team_id}"

    for skill_md in $(find "$skills_dir" -name 'SKILL.md' -not -path '*/test/SKILL.md'); do
        skill_dir="$(dirname "$skill_md")"
        skill_name="$(basename "$skill_dir")"
        rel="$(echo "$skill_dir" | sed "s|^${skills_dir}/||")"

        target_dir="${UNIFIED}/${rel}"
        mkdir -p "$(dirname "$target_dir")"

        if [ -e "$target_dir" ]; then
            echo "    SKIP ${rel} — already exists in unified dir"
            continue
        fi

        echo "    MOVE ${rel} — team ${team_id}"
        cp -a "$skill_dir" "$target_dir"

        sed -i "/metadata:/{
          :a; n; /hermes:/{
            /owner_id:/!s|hermes:|hermes:\n    owner_id: \"${team_id}\"\n    scope: \"team\"|m
            :b; n; /^[[:space:]]/b b
          };
          /hermes:/!s|hermes:|\n  hermes:\n    owner_id: \"${team_id}\"\n    scope: \"team\"|m
        }" "${target_dir}/SKILL.md" 2>/dev/null || true
    done
done

echo ""
echo "=== Migration complete ==="
echo "Legacy dirs preserved in place. Unified dir: ${UNIFIED}"
find "${UNIFIED}" -name 'SKILL.md' | while read f; do
    name="$(grep '^name:' "$f" | head -1 | sed 's/name: *//')"
    scope="$(grep 'scope:' "$f" | head -1 | sed 's/.*scope: *//' | tr -d '"')"
    echo "  $name  ($scope)"
done
