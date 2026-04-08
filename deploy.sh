#!/bin/bash
# VINTINUUM DEPLOY — bumps SW cache version, commits, pushes
# Usage: ./deploy.sh "commit message"
# Or just: ./deploy.sh  (uses auto message)

set -e

MSG="${1:-Update}"
VER="v$(date +%Y%m%d-%H%M)"

echo "🧠 Vintinuum deploy — version $VER"

# Bump cache version in sw.js
sed -i "s/const CACHE_NAME = 'vintinuum-[^']*'/const CACHE_NAME = 'vintinuum-$VER'/" sw.js

# Bump version in brain.html SW registration
sed -i "s/const _SW_VERSION = '[^']*'/const _SW_VERSION = '$VER'/" brain.html

# Bump brain.js cache bust in brain.html script tag
sed -i "s/brain\.js?v=[^\"']*/brain.js?v=$VER/" brain.html

echo "✓ Versions bumped to $VER"

git add -A
git commit -m "$MSG [deploy $VER]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main

echo "✓ Pushed — GitHub Pages rebuilding with $VER"
echo "  GitHub Pages will serve fresh brain.js within ~60s"
echo "  Open tabs will auto-reload when SW activates"
