#!/usr/bin/env bash
# install.sh — Install or update gitea-teammate workflows in your project
#
# Usage:
#   bash install.sh
#
# Environment overrides:
#   REF                    Tag or branch of gitea-teammate to pin (default: main)
#   SOURCE_REPO            Where to clone the workflow stubs from
#                          (default: https://github.com/zeyber/gitea-teammate)
#   SOURCE_TOKEN           Token for SOURCE_REPO, if it is private
#   TEAMMATE_BASE  What the generated workflows resolve actions against
#                          (default: zeyber/gitea-teammate)
#   TEAMMATE_USER               Account the workflows watch for (default: Teammate)
#   TEAMMATE_RUNNER        Runner label the workflows target (default: ubuntu-latest)
#   WORKFLOW_DIR           Where to write the stubs (default: .gitea/workflows)
#
# TEAMMATE_BASE accepts either form:
#   zeyber/gitea-teammate                          resolved against your Gitea
#                                                    instance's default actions URL
#   https://gitea.example.net/owner/gitea-teammate  a specific Gitea instance
#
# For a private Gitea host, pass the secret expression through verbatim so the
# token stays in secrets rather than in a plaintext repo variable:
#   TEAMMATE_BASE='https://${{ secrets.SERVER_TOKEN }}@gitea.example.net/owner/gitea-teammate'

set -euo pipefail

REF="${REF:-main}"
SOURCE_REPO="${SOURCE_REPO:-https://github.com/zeyber/gitea-teammate}"
TEAMMATE_BASE="${TEAMMATE_BASE:-zeyber/gitea-teammate}"
WORKFLOW_DIR="${WORKFLOW_DIR:-.gitea/workflows}"
TEAMMATE_USER="${TEAMMATE_USER:-Teammate}"
TEAMMATE_RUNNER="${TEAMMATE_RUNNER:-ubuntu-latest}"

CLONE_URL="$SOURCE_REPO"
if [ -n "${SOURCE_TOKEN:-}" ]; then
  CLONE_URL="$(echo "$CLONE_URL" | sed "s|://|://${SOURCE_TOKEN}@|")"
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "==> Installing gitea-teammate workflows"
echo "    source: $SOURCE_REPO@$REF"
echo "    base:   $TEAMMATE_BASE"
echo "    bot:    $TEAMMATE_USER"
echo "    runner: $TEAMMATE_RUNNER"
echo "    into:   $WORKFLOW_DIR"
echo ""

git clone --depth 1 --branch "$REF" "$CLONE_URL" "$TMPDIR" 2>/dev/null || {
  echo "ERROR: Failed to clone $SOURCE_REPO (ref: $REF)."
  echo "  Check the URL, ref, and SOURCE_TOKEN permissions."
  exit 1
}

mkdir -p "$WORKFLOW_DIR"

# A base carrying a `${{ secrets.* }}` expression cannot sit inside the
# `vars.X || '...'` fallback — nested expressions are never evaluated. Emit it
# directly in that case, and keep the overridable fallback otherwise.
case "$TEAMMATE_BASE" in
  *'${{'*) BASE_LINE="$TEAMMATE_BASE" ;;
  *)       BASE_LINE="\${{ vars.TEAMMATE_BASE || '$TEAMMATE_BASE' }}" ;;
esac

# Rewrite the repo-local `uses: ./actions/<name>` into a cross-repo reference,
# and pin the default base so the installed workflows resolve without further edits.
for f in "$TMPDIR"/.gitea/workflows/teammate-*.yml; do
  [ -f "$f" ] || continue
  out="$WORKFLOW_DIR/$(basename "$f")"
  sed \
    -e "s#uses: \./actions/\(.*\)#uses: \${{ env.TEAMMATE_BASE }}/actions/\1@\${{ env.TEAMMATE_REF }}#g" \
    -e "s#^      TEAMMATE_BASE:.*#      TEAMMATE_BASE: $BASE_LINE#" \
    -e "s#'main' }}#'$REF' }}#g" \
    -e "s#'Teammate'#'$TEAMMATE_USER'#g" \
    -e "s#'ubuntu-latest'#'$TEAMMATE_RUNNER'#g" \
    "$f" > "$out"
  echo "  -> Created $out"
done

echo ""
echo "==> Done!"
echo ""
echo "Next steps:"
echo ""
echo "  1. Commit the new files:"
echo "       git add $WORKFLOW_DIR/"
echo "       git commit -m \"chore: add gitea-teammate workflows\""
echo ""
echo "  2. Set the repo variable:"
echo "       SERVER_URL   - Your Gitea instance URL (e.g. https://gitea.example.net)"
echo ""
echo "  3. Set the repo secret:"
echo "       SERVER_TOKEN - Gitea API token with contents, issues and PR access"
echo ""
echo "  4. Create a Gitea user named '$TEAMMATE_USER' and give it access to the repo."
echo "     Workflows trigger on issues and PRs assigned to that user."
echo "     To rename it later, set the repo variable TEAMMATE_USER."
echo ""
echo "  5. Required: commit your own .opencode/opencode.json naming a real provider"
echo "     and model. The shipped file is a placeholder and will not connect to"
echo "     anything. Whatever you provide is left alone; only missing files are"
echo "     seeded at run time."
echo ""
echo "To update later, re-run with the new ref:"
echo "  REF=v1.0.0 bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/zeyber/gitea-teammate/v1.0.0/install.sh)\""
