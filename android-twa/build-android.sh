#!/usr/bin/env bash
# build-android.sh — finish the Vintinuum Android (TWA) build.
#
# STATE (already done by the prep run):
#   • Bubblewrap CLI installed (npm -g @bubblewrap/cli)
#   • JDK 17 + Android SDK downloaded to ~/.bubblewrap
#   • Signing keystore created: ./android.keystore  (storepass/keypass: vintinuum2026)
#   • ./twa-manifest.json fully configured (packageId, signingKey, shortcuts)
#
# WHAT'S LEFT (this script):
#   • `bubblewrap init` to generate the Android gradle project — INTERACTIVE,
#     needs a real terminal (TTY). Run this script in YOUR terminal, not headless.
#   • `bubblewrap build` to produce the signed app-release-bundle.aab.
#   • emit assetlinks.json from the keystore SHA256.
#
# USAGE (in a normal terminal):
#   cd ~/vintinuum/android-twa && ./build-android.sh
#   (accept any prompts; passwords are vintinuum2026 if asked)
set -uo pipefail
cd "$(dirname "$0")"

JDK="$(dirname "$(dirname "$(find "$HOME/.bubblewrap/jdk" -name keytool -type f 2>/dev/null | head -1)")")"
export JAVA_HOME="$JDK"
export PATH="$JDK/bin:$PATH"
echo "JAVA_HOME=$JAVA_HOME"

MANIFEST_URL="https://vintaclectic.github.io/vintinuum/manifest.webmanifest"
if ! curl -sf -o /dev/null "$MANIFEST_URL"; then
  echo "✗ manifest not live — push the frontend, wait ~1 min, retry."; exit 1
fi

# 1. Generate the gradle project if not present. twa-manifest.json supplies the
#    config; init still asks a couple of confirmations — accept them.
if [ ! -f "build.gradle" ] && [ ! -d "app" ]; then
  echo "── init (generates the Android project; answer the prompts) ──"
  bubblewrap init --manifest "$MANIFEST_URL" --directory .
fi

# 2. Build the signed App Bundle.
echo "── build ──"
bubblewrap build

# 3. assetlinks.json from the keystore fingerprint (removes the URL bar).
if [ -f "android.keystore" ]; then
  FP="$(keytool -list -v -keystore android.keystore -alias android \
        -storepass vintinuum2026 2>/dev/null | grep 'SHA256:' | awk '{print $2}')"
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
    echo "✅ assetlinks.json written (fingerprint $FP)"
    echo "   → copy to frontend: cp assetlinks.json ../.well-known/assetlinks.json && commit && push"
  fi
fi

echo ""
echo "── done ──"
ls -la ./*.aab 2>/dev/null && echo "Upload the .aab to Play Console (see PLAY_LISTING.md)." \
  || echo "No .aab yet — check the build output above."
echo "KEEP android.keystore + password (vintinuum2026) SAFE — it signs every update."
