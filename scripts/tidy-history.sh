#!/usr/bin/env bash
# One-time: make the git history read as engineering work rather than CI flail.
#
# Two operations, both content-preserving:
#   1. Drop empty commits (deploy triggers: "test deploy", "force redeploy",
#      "trigger Railway redeploy", ...). These changed no files, so nothing is
#      lost. Pruning is delegated to git-filter-repo's --prune-empty=always
#      rather than a hand-rolled commit.skip(): skip() remaps the commit's
#      children onto its parents, and in this repo that orphaned every ancestor
#      of the skipped commit -- 231 commits and 10 files vanished. The built-in
#      pruner does the remapping correctly.
#   2. Rewrite messages that say nothing ("fix", "update: 2026-05-09 22:12")
#      into a description derived from the files the commit actually touched,
#      so no message claims work the commit did not do.
#
# --prune-degenerate=never keeps the two merge commits intact.
#
# Backs up to a mirror first, verifies the final tree hash is byte-identical to
# the original, and stops before pushing.
set -euo pipefail

REPO_URL="https://github.com/ubaldo28/potuswatch.git"
BACKUP="../potuswatch-backup-tidy-$(date +%Y%m%d-%H%M%S).git"

command -v git-filter-repo >/dev/null 2>&1 || {
  echo 'git-filter-repo not on PATH. Run:  export PATH="$HOME/bin:$PATH"'; exit 1; }

echo "==> Backing up to ${BACKUP}"
git clone --mirror . "${BACKUP}" >/dev/null
BEFORE=$(git rev-list --count HEAD)
TREE_BEFORE=$(git rev-parse HEAD^{tree})
echo "    commits: ${BEFORE}   tree: ${TREE_BEFORE}"

cat > /tmp/tidy_cb.py <<'PY'
import re, os

RENAME = {
    b'audit fixes':  b'Apply SEO audit fixes',
    b'fix':          b'Rework the homepage markup',
    b'debug: add version marker to confirm deployment':
                     b'Add a build marker to verify the deploy pipeline',
}
DATED = re.compile(rb'^update(:| site)\s*(20\d\d-\d\d-\d\d[ \d:]*)?$', re.I)

msg = commit.message.strip()
low = msg.lower()

if low in RENAME:
    commit.message = RENAME[low] + b'\n'
elif DATED.match(msg):
    # Derive an honest message from what the commit actually touched.
    paths = sorted({os.path.basename(c.filename).decode('utf-8', 'replace')
                    for c in commit.file_changes})
    if not paths:
        pass
    elif len(paths) == 1:
        commit.message = b'Update ' + paths[0].encode() + b'\n'
    else:
        commit.message = ('Update %s and %d other file%s'
                          % (paths[0], len(paths) - 1,
                             '' if len(paths) == 2 else 's')).encode() + b'\n'
PY

echo "==> Rewriting"
git filter-repo --force \
  --prune-empty=always \
  --prune-degenerate=never \
  --commit-callback "$(cat /tmp/tidy_cb.py)"

git remote add origin "${REPO_URL}" 2>/dev/null || git remote set-url origin "${REPO_URL}"

AFTER=$(git rev-list --count HEAD)
TREE_AFTER=$(git rev-parse HEAD^{tree})
echo "==> commits: ${BEFORE} -> ${AFTER}  (dropped $((BEFORE-AFTER)) empty)"

if [ "${TREE_BEFORE}" != "${TREE_AFTER}" ]; then
  echo "!!  TREE CHANGED (${TREE_BEFORE} -> ${TREE_AFTER}). Content was lost."
  echo "!!  Do not push. Restore with:"
  echo "!!    git remote add backup \"\$(cd .. && pwd)/$(basename "${BACKUP}")\" && git fetch backup && git reset --hard backup/main"
  exit 1
fi
echo "==> tree unchanged (${TREE_AFTER}) -- no file content lost"

echo
echo "==> noise still present? (want: clean)"
git log --oneline | grep -iE 'test deploy|trigger.*redeploy|force redeploy|version marker|^[0-9a-f]+ fix$' || echo "    clean"
echo
echo "Review:  git log --oneline | head -40"
echo "Then:    git push --force --all"
