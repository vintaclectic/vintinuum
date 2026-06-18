#!/usr/bin/env bash
# build-android.sh — turn the Vintinuum PWA into a Play-Store-ready Android app
# (Trusted Web Activity) using Bubblewrap. One command, from a clean machine.
#
# Prereqs this script installs/uses:
#   - Node (already present)
#   - @bubblewrap/cli (installed here if missing)
#   - JDK 17 + Android SDK — Bubblewrap will offer to download these on first run
#
# Output: ./app-release-bundle.aab  (upload to Play Console)
#         ./assetlinks.json         (deploy to /.well-known/ on the site)
set -euo pipefail
cd "$(dirname "$0")"

echo "── Vintinuum → Android (TWA) build ─────────────────────────────"

# 1. Bubblewrap
if ! command -v bubblewrap >/dev/null 2>&1; then
  echo "Installing @bubblewrap/cli globally…"
  npm install -g @bubblewrap/cli
fi

# 2. The manifest must be LIVE (Bubblewrap fetches it).
echo "Checking the web manifest is reachable…"
if ! curl -sf -o /dev/null "https://vintaclectic.github.io/vintinuum/manifest.webmanifest"; then
  echo "✗ manifest.webmanifest is not live yet. Push the frontend first, wait ~1 min, retry."
  exit 1
fi

# 3. Init the project from our pre-written twa-manifest.json (idempotent-ish).
if [ ! -f "build.gradle" ] && [ ! -d "app" ]; then
  echo "Initializing TWA project from twa-manifest.json…"
  # --manifest points Bubblewrap at our config; it will prompt for JDK/SDK download
  # the first time (accept it). Signing key is created on first build.
  bubblewrap init --manifest "https://vintaclectic.github.io/vintinuum/manifest.webmanifest" || true
  echo ""
  echo "NOTE: if init asked questions, the answers are in twa-manifest.json:"
  echo "  packageId: com.vintaclectic.vintinuum   host: vintaclectic.github.io"
  echo "  startUrl:  /vintinuum/brain.html?source=twa"
fi

# 4. Build the signed App Bundle.
echo "Building the release bundle…"
bubblewrap build

# 5. Emit assetlinks.json so the app verifies its domain (kills the URL bar).
#    The SHA256 comes from the signing key Bubblewrap just created.
if command -v keytool >/dev/null 2>&1 && [ -f "android.keystore" ]; then
  FP="$(keytool -list -v -keystore android.keystore -alias android 2>/dev/null \
        | grep 'SHA256:' | awk '{print $2}')"
  if [ -n "${FP:-}" ]; then
    cat > assetlinks.json <<EOF
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.vintaclectic.vintinuum",
    "sha256_cert_fingerprints": ["$FP"]
  }
}]
EOF
    echo "✅ Wrote assetlinks.json (fingerprint $FP)"
    echo "   Deploy it to: https://vintaclectic.github.io/vintinuum/.well-known/assetlinks.json"
    echo "   (copy android-twa/assetlinks.json → frontend repo .well-known/ and push)"
  fi
fi

echo ""
echo "── Done ─────────────────────────────────────────────────────────"
echo "AAB:        $(ls -1 ./*.aab 2>/dev/null | head -1 || echo 'see build output')"
echo "Next: Play Console → create app → upload the .aab → add listing (see PLAY_LISTING.md)"
echo "IMPORTANT: keep android.keystore + its password SAFE — it signs every future update."
