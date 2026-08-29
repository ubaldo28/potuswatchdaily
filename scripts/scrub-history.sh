#!/usr/bin/env bash
# One-time: remove the .env blob (and the committed node_modules) from every
# commit in this repository's history, before the repo is made public.
#
# READ THIS FIRST:
#   * Rotate all six credentials BEFORE running this. Rewriting history does
#     not un-leak anything — the keys are already in every existing clone, and
#     GitHub keeps unreachable objects addressable by SHA. The rewrite stops
#     FUTURE exposure; rotation is what closes the actual hole.
#   * This rewrites every commit SHA. Any open PR or other clone must be
#     re-created from the new history.
#   * A full backup is taken first, into ../potuswatch-backup-<timestamp>.git
set -euo pipefail

REPO_URL="https://github.com/ubaldo28/potuswatch.git"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="../potuswatch-backup-${STAMP}.git"

command -v git-filter-repo >/dev/null 2>&1 || {
  echo "git-filter-repo is not installed. Install it with:"
  echo "  brew install git-filter-repo"
  exit 1
}

echo "==> Backing up to ${BACKUP}"
git clone --mirror . "${BACKUP}"
echo "    Backup complete. If anything goes wrong, restore from there."

echo "==> Checking what will be removed"
git log --all --oneline -- .env || true

echo "==> Rewriting history"
git filter-repo --force \
  --invert-paths \
  --path .env \
  --path .dev.vars \
  --path node_modules \
  --mailmap <(printf 'Ubi <potuswatchdaily@gmail.com> <purpleworldinc@Ubaldos-MacBook-Pro.local>\n')

echo "==> Re-adding the remote (filter-repo drops it deliberately)"
git remote add origin "${REPO_URL}" 2>/dev/null || git remote set-url origin "${REPO_URL}"

echo "==> Verifying .env is gone from every ref"
if git log --all --oneline -- .env | grep -q .; then
  echo "FAILED: .env still present in history. Do not push. Restore from ${BACKUP}."
  exit 1
fi
echo "    Clean."

cat <<'NEXT'

==> Not pushed yet. Review, then run:

      git push --force --all
      git push --force --tags

    Then delete the stale remote branches that still carry the old history:

      git push origin --delete seo-and-stability-fixes
      git push origin --delete cloudflare/workers-autoconfig

    Then, in GitHub → Settings → Code security, enable:
      Secret scanning, Push protection, Dependabot alerts, Dependabot security updates

    Only then make the repository public.
NEXT
