#!/bin/bash
# POTUS Watch deploy script
# Usage: ./deploy.sh
# Or with a message: ./deploy.sh "fix: better article prompt"

set -e

REPO_DIR="$(dirname "$0")"
DOWNLOADS=~/Downloads
MSG=${1:-"update: $(date '+%Y-%m-%d %H:%M')"}

echo "🚀 POTUS Watch deployer"
echo ""

# Copy any updated files from Downloads if they exist
copy_if_exists() {
  local file=$1
  local dest=$2
  if [ -f "$DOWNLOADS/$file" ]; then
    cp "$DOWNLOADS/$file" "$REPO_DIR/$dest"
    echo "✓ Updated $dest"
  fi
}

copy_if_exists "index.html"      "public/index.html"
copy_if_exists "localserver.js"  "localserver.js"
copy_if_exists "article.js"      "api/article.js"
copy_if_exists "sitemap.js"      "api/sitemap.js"
copy_if_exists "vercel.json"     "vercel.json"

# Git push
cd "$REPO_DIR"
git add .

if git diff --cached --quiet; then
  echo "Nothing changed — already up to date."
  exit 0
fi

git commit -m "$MSG"
git push

echo ""
echo "✅ Deployed! Vercel will be live in ~30 seconds."
echo "   https://potuswatchdaily.com"
