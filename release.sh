#!/usr/bin/env bash
set -euo pipefail

TITLE=""
NOTES=""
BUILD_MODE="cloud"

usage() {
  echo "Usage: $0 --title <title> [--note <note>] [--local | --cloud]"
  echo ""
  echo "  -t, --title   Release title (required)"
  echo "  -n, --note    Release notes (optional)"
  echo "  --local       Build on this machine (requires Android SDK + Gradle)"
  echo "  --cloud       Build on EAS servers and download artifact (default)"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--title) TITLE="$2"; shift 2 ;;
    -n|--note)  NOTES="$2"; shift 2 ;;
    --local)    BUILD_MODE="local"; shift ;;
    --cloud)    BUILD_MODE="cloud"; shift ;;
    *) echo "Unknown argument: $1"; usage ;;
  esac
done

[[ -z "$TITLE" ]] && { echo "Error: --title is required"; usage; }

# --- Early checks ---------------------------------------------------------
if [[ "$BUILD_MODE" == "local" ]]; then
  if [[ -z "${ANDROID_HOME:-}" ]]; then
    echo "Error: ANDROID_HOME is not set."
    echo ""
    echo "Local builds require the Android SDK. Either:"
    echo "  1. Set ANDROID_HOME and add the SDK tools to PATH, e.g.:"
    echo "       export ANDROID_HOME=\$HOME/Library/Android/sdk"
    echo "       export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
    echo "  2. Use --cloud instead (no Android SDK needed)"
    exit 1
  fi
  # Gradle requires Java 17 or 21 — pin to 21 if available, regardless of sdkman default
  JAVA21=$(/usr/libexec/java_home -v 21 2>/dev/null || true)
  if [[ -n "$JAVA21" ]]; then
    export JAVA_HOME="$JAVA21"
  elif ! command -v java &>/dev/null; then
    echo "Error: java not found. Gradle requires Java 17 or 21."
    echo "Install via sdkman: sdk install java 21.0.10-tem"
    exit 1
  else
    JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
    if [[ "$JAVA_VER" -gt 21 ]]; then
      echo "Error: Java $JAVA_VER is not supported by Gradle. Switch to Java 17 or 21."
      echo "With sdkman: sdk default java 21.0.10-tem"
      exit 1
    fi
  fi
  echo "▶ Using Java: $JAVA_HOME"
fi

cd "$(dirname "$0")"

# --- Bump version (file only — commit happens after a successful build) ---
PREV_VERSIONS=$(node -e "
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
process.stdout.write(app.expo.version + ' ' + app.expo.android.versionCode);
")
PREV_VERSION=$(echo "$PREV_VERSIONS" | cut -d' ' -f1)
PREV_VERSION_CODE=$(echo "$PREV_VERSIONS" | cut -d' ' -f2)

NEW_VERSIONS=$(node -e "
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const [major, minor, patch] = app.expo.version.split('.').map(Number);
app.expo.version = major + '.' + minor + '.' + (patch + 1);
app.expo.android.versionCode = (app.expo.android.versionCode || 0) + 1;
fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
process.stdout.write(app.expo.version + ' ' + app.expo.android.versionCode);
")
VERSION=$(echo "$NEW_VERSIONS" | cut -d' ' -f1)
VERSION_CODE=$(echo "$NEW_VERSIONS" | cut -d' ' -f2)
TAG="v$VERSION"
APK_NAME="PatientApp-${TAG}.apk"

echo "▶ Bumped to $TAG (versionCode $VERSION_CODE)"

# Restore app.json if anything below fails
restore_version() {
  echo "✗ Build failed — restoring app.json to $PREV_VERSION (versionCode $PREV_VERSION_CODE)"
  node -e "
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
app.expo.version = '$PREV_VERSION';
app.expo.android.versionCode = $PREV_VERSION_CODE;
fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
"
}
trap restore_version ERR

# --- Build APK ------------------------------------------------------------
if [[ "$BUILD_MODE" == "local" ]]; then
  echo "▶ Building APK locally (Gradle)..."
  touch /tmp/eas_build_marker
  eas build --platform android --profile preview --local --non-interactive
  APK=$(find . -maxdepth 1 -name "*.apk" -newer /tmp/eas_build_marker | head -1)
  [[ -z "$APK" ]] && { echo "Error: No APK found after build"; exit 1; }
  mv "$APK" "$APK_NAME"
else
  echo "▶ Building APK on EAS cloud (this may take a few minutes)..."
  BUILD_URL=$(eas build --platform android --profile preview --non-interactive --json \
    | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).artifacts.buildUrl))")
  [[ -z "$BUILD_URL" ]] && { echo "Error: Could not get build URL from EAS"; exit 1; }
  echo "▶ Downloading from $BUILD_URL..."
  curl -L --progress-bar -o "$APK_NAME" "$BUILD_URL"
fi

echo "▶ Built $APK_NAME"

# Build succeeded — clear the restore trap and commit
trap - ERR

# --- Commit + push --------------------------------------------------------
git add app.json
git commit -m "release $TAG (build $VERSION_CODE)"
git push origin HEAD

# --- GitHub release -------------------------------------------------------
echo "▶ Creating GitHub release $TAG..."
gh release create "$TAG" "$APK_NAME" \
  --title "$TITLE" \
  --notes "$NOTES"

rm "$APK_NAME"

echo "✓ Done — $TAG released: $TITLE"
