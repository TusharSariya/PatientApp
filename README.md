# PatientApp — Patient Manager

A React Native app (Expo) for managing patient records on-device. Stores first, middle, and last names, plus phone number and address using SQLite. Supports iOS and Android.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
   - [All Platforms](#all-platforms)
   - [macOS — iOS & Android](#macos--ios--android)
   - [Linux — Android only](#linux--android-only)
   - [Windows — Android only](#windows--android-only)
2. [Running the App](#running-the-app)
   - [Option A: Expo Go (quickest)](#option-a-expo-go-quickest)
   - [Option B: iOS Simulator (macOS only)](#option-b-ios-simulator-macos-only)
   - [Option C: Android Emulator](#option-c-android-emulator)
3. [Running Tests](#running-tests)
   - [Run all tests once](#run-all-tests-once)
   - [Watch mode](#watch-mode)
   - [Coverage report](#coverage-report)
   - [Run a single test file](#run-a-single-test-file)
4. [Building & Releasing an APK](#building--releasing-an-apk)
5. [Project Structure](#project-structure)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### All Platforms

1. **Node.js 18+**
   - Download from [nodejs.org](https://nodejs.org) (LTS recommended).
   - Verify: `node -v` and `npm -v`

2. **Git**
   - macOS: `xcode-select --install` or [git-scm.com](https://git-scm.com)
   - Linux: `sudo apt install git` (Ubuntu/Debian) or `sudo dnf install git` (Fedora)
   - Windows: [git-scm.com](https://git-scm.com)

3. **Expo CLI**
   ```bash
   npm install -g expo-cli
   ```

4. **Clone and install**
   ```bash
   git clone <your-repo-url>
   cd PatientApp
   npm install
   ```

---

### macOS — iOS & Android

#### iOS (Simulator)

1. Install **Xcode** from the Mac App Store (large download, ~15 GB).
2. Open Xcode once to accept the license agreement.
3. Install the iOS Simulator components: Xcode → Settings → Platforms → add the iOS version you want.
4. Install Xcode Command Line Tools:
   ```bash
   xcode-select --install
   ```
5. Install **Watchman** (file watcher used by Metro):
   ```bash
   brew install watchman
   ```
   If you don't have Homebrew: [brew.sh](https://brew.sh)

#### Android (Emulator) on macOS

1. Install **Android Studio** from [developer.android.com/studio](https://developer.android.com/studio).
2. During setup choose **Standard** installation (includes the Android SDK and emulator).
3. Open Android Studio → **More Actions** → **SDK Manager**.
   - SDK Platforms tab: check **Android 14 (API 34)** or newer.
   - SDK Tools tab: check **Android SDK Build-Tools**, **Android Emulator**, **Android SDK Platform-Tools**.
   - Click **Apply**.
4. Create a virtual device: **More Actions** → **Virtual Device Manager** → **Create Device** → pick a phone (e.g. Pixel 8) → select a system image → Finish.
5. Add the Android SDK to your shell environment. Add these lines to `~/.zshrc` (or `~/.bash_profile`):
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```
   Then reload: `source ~/.zshrc`
6. Verify: `adb --version`

---

### Linux — Android only

> iOS development requires macOS and Xcode — it is not possible on Linux.

1. Install **Java 17**:
   ```bash
   # Ubuntu/Debian
   sudo apt update && sudo apt install openjdk-17-jdk

   # Fedora
   sudo dnf install java-17-openjdk
   ```
2. Install **Android Studio** from [developer.android.com/studio](https://developer.android.com/studio) or via your distro's package manager (e.g. `snap install android-studio --classic`).
3. Follow steps 2–6 from the macOS Android section above, but the SDK path is:
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```
   Add those lines to `~/.bashrc` or `~/.zshrc`, then `source` it.
4. Install **Watchman**:
   ```bash
   # Ubuntu — build from source or use the pre-built binary
   sudo apt install watchman
   ```
   Or follow the official guide: [facebook.github.io/watchman](https://facebook.github.io/watchman/docs/install.html)
5. Enable KVM for faster emulation (optional but recommended):
   ```bash
   sudo apt install qemu-kvm
   sudo usermod -aG kvm $USER
   # log out and back in
   ```

---

### Windows — Android only

> iOS development requires macOS — it is not possible on Windows.

1. Install **Node.js 18+** from [nodejs.org](https://nodejs.org).
2. Install **Git** from [git-scm.com](https://git-scm.com). During setup, choose "Git from the command line and also from 3rd-party software".
3. Install **Java 17** (JDK):
   - Download from [Adoptium](https://adoptium.net) — choose **Temurin 17**.
   - During install, check **"Set JAVA_HOME variable"**.
4. Install **Android Studio** from [developer.android.com/studio](https://developer.android.com/studio).
   - Choose **Standard** setup. This installs the Android SDK and emulator automatically.
5. Set environment variables (System → Advanced system settings → Environment Variables):
   - New system variable: `ANDROID_HOME` = `C:\Users\<YourName>\AppData\Local\Android\Sdk`
   - Edit `Path` and add:
     - `%ANDROID_HOME%\emulator`
     - `%ANDROID_HOME%\platform-tools`
6. Open a **new** terminal and verify: `adb --version`
7. Create a virtual device in Android Studio: **More Actions** → **Virtual Device Manager** → **Create Device**.

> **Tip:** Use **Windows Terminal** or **PowerShell** rather than the old Command Prompt for a better experience.

---

## Running the App

### Option A: Expo Go (quickest)

No simulator or emulator needed. Runs on your real phone.

1. Install **Expo Go** on your phone:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
2. Start the dev server:
   ```bash
   npm start
   ```
3. **iOS:** Open the Camera app and scan the QR code shown in the terminal.  
   **Android:** Open the Expo Go app and tap **Scan QR code**.

> Your phone and computer must be on the same Wi-Fi network.

---

### Option B: iOS Simulator (macOS only)

1. Start the server and open the simulator:
   ```bash
   npm run ios
   # or: npx expo start, then press 'i'
   ```
   Expo will automatically boot the simulator and install the app.

---

### Option C: Android Emulator

1. Open Android Studio → **Virtual Device Manager** → click the play button on your AVD to start it.
2. Once the emulator is booted, run:
   ```bash
   npm run android
   # or: npx expo start, then press 'a'
   ```

---

## Running Tests

Tests are configured with **Jest** using Expo's preset (`jest-expo`) and React Native Testing Library.

### Run all tests once

```bash
npm test
```

### Watch mode

```bash
npm run test:watch
```

### Coverage report

```bash
npm run test:coverage
```

This generates a local coverage report in `coverage/`.

### Run a single test file

```bash
npx jest __tests__/GestureInputProvider.test.js
```

You can replace the file path with any test file in `__tests__/`.

### Git hooks and CI

A **pre-push** hook (via [Husky](https://typicode.github.io/husky/)) runs `npm test` before every `git push`. Hooks are installed automatically when you run `npm install`.

GitHub Actions runs the same test suite on every push to `main` and on all pull requests (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

To bypass the local hook in an emergency:

```bash
git push --no-verify
```

Consider enabling branch protection on `main` in your GitHub repo settings so merges require the CI check to pass.

### On-device visit dictation (Gemma 4)

PatientApp can dictation-fill a visit form using **Gemma 4** via [LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM) (`react-native-litert-lm`). Audio and extraction run on the phone; no visit data is sent to a cloud LLM.

**Requirements**

- Custom dev/production build (not Expo Go)
- Physical ARM device (Android API 26+, iOS 15+)
- ~3 GB free storage for the model download
- 4 GB+ RAM for Gemma 4 E2B; 6 GB+ recommended for E4B
- iOS: paid Apple Developer account for the extended virtual addressing entitlement

**Setup**

1. Open **Settings → Visit AI**
2. Choose **E2B** (default) or **E4B**
3. Tap **Download model** and wait for the on-device cache to finish
4. On a patient’s **Visits** screen, tap **Dictate Visit**, record the encounter, review extracted fields, then **Apply**

Inference uses Gemma native audio when the model is loaded. If the model is unavailable, the app can capture a transcript with system speech, but extraction still requires the downloaded model.

Rebuild native projects after installing dependencies:

```bash
npx expo prebuild --clean
npx expo run:ios --device
# or
npx expo run:android --device
```

### Interaction test matrix

The suite includes an **interaction matrix** (~229 tests) that covers:

- Every primary screen action (navigation, save, validation alerts, empty/loading/error states)
- Cross-product **input modes** (`gestures`, `voice`, `keyboard`) with real `GesturePad` touch simulation
- Gesture outcomes (match, no-match, invalid, undo, invert, dictation)
- Database flows (`addVisit`, payments, balances, family search, visit history)
- Shared helpers in `__tests__/helpers/` (`gesturePadSim.js`, `matrix.js`, `GestureFieldHarness.js`, `seedGestures.js`)

Matrix-focused files include `inputModeGestureMatrix.test.js`, expanded screen tests, and `GesturePad.test.js` (real responder paths, not mocks).

### Reporting problems and crashes

When something fails, users can send you diagnostics without exposing patient names or medical records.

**In the app (manual report):**

1. Open **Settings → Report a problem**
2. Describe what happened
3. Tap **Send report** and share via email, WhatsApp, or any installed app

The shared text file includes app version, device/OS info, currency/input mode, patient count (number only), recent errors from the current session, and the user's notes.

Error alerts on key flows (new patient, visit save, clinic profile save) also include a **Report** button that opens the same screen.

**Automatic reporting (optional Sentry):**

1. Create a project at [sentry.io](https://sentry.io)
2. Set `EXPO_PUBLIC_SENTRY_DSN` in EAS secrets or a local `.env` file (do not commit the DSN)
3. Rebuild the app with EAS or `expo run:ios` / `expo run:android`

If the DSN is not set, the app still works using the in-app share flow only. Sentry receives technical errors only; patient fields are redacted in `beforeSend`.

---

## Building & Releasing an APK

Use `release.sh` to build, version-bump, and publish an APK to GitHub Releases in one command. It auto-increments the version on every run.

### Prerequisites

1. **EAS CLI**
   ```bash
   npm install -g eas-cli
   ```
2. **Expo account** — [expo.dev](https://expo.dev) (free), then log in:
   ```bash
   eas login
   ```
3. **GitHub CLI** — [cli.github.com](https://cli.github.com), then log in:
   ```bash
   gh auth login
   ```

### Usage

```bash
./release.sh --title "Release title" --note "What changed"
```

| Flag | Description |
|------|-------------|
| `-t`, `--title` | Release title shown on GitHub **(required)** |
| `-n`, `--note` | Release notes / changelog (optional) |
| `--cloud` | Build on EAS servers and download the APK **(default)** |
| `--local` | Build on this machine — requires Android SDK and Gradle |

### Examples

```bash
# Cloud build (no Android SDK needed)
./release.sh --title "v1.1 — Medicine list" --note "Added medicines to Rx tab"

# Local build (faster if Android SDK is set up)
./release.sh --title "Hotfix" --note "Fixed crash on empty Rx tab" --local
```

### What the script does

1. Increments the patch version in `app.json` (`1.0.0` → `1.0.1`) and bumps `versionCode`
2. Commits and pushes the version bump
3. Builds the APK (cloud or local)
4. Creates a GitHub release tagged `v{version}` and uploads the APK
5. Deletes the local APK (it lives in the GitHub release)

The APK will appear under **Releases** on the GitHub repo. Anyone can download and sideload it on an Android device.

> **Sideloading on Android:** the device must have **Install unknown apps** enabled (Settings → Apps → Special app access → Install unknown apps).

---

## Project Structure

```
PatientApp/
├── App.js                      # Root component, navigation setup
├── release.sh                  # Build + publish APK to GitHub Releases
├── src/
│   ├── HomeScreen.js           # Landing page with navigation cards
│   ├── AddPatientScreen.js     # Form to register a new patient
│   ├── SearchScreen.js         # Search and list all patients
│   ├── PatientDetailScreen.js  # Patient info, Rx fields, medicines
│   └── database.js             # SQLite helpers (patients + medicines)
├── assets/                     # Icons and splash screen images
├── app.json                    # Expo config (version + versionCode)
├── eas.json                    # EAS build profiles
└── package.json
```

**Stack:**
- [Expo](https://expo.dev) SDK 54
- [React Native](https://reactnative.dev) 0.81
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) — on-device SQLite database
- [React Navigation](https://reactnavigation.org) — native stack navigator

---

## Troubleshooting

**`npm install` fails**  
Make sure you are on Node 18 or later: `node -v`

**Metro bundler port conflict**  
Kill whatever is on port 8081: `npx kill-port 8081`, then re-run `npm start`.

**Android: `adb` not found**  
Your `ANDROID_HOME` / `PATH` env vars are not set correctly. Re-check the steps for your OS and open a fresh terminal window after saving changes.

**iOS Simulator won't open**  
Run `xcode-select --install` and make sure Xcode has an iOS platform downloaded (Xcode → Settings → Platforms).

**"Unable to resolve module" error**  
Delete caches and reinstall:
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

**Expo Go shows a blank screen or crashes**  
This app uses `expo-sqlite`, which requires a **development build** when running on a real device with certain SDK versions. If Expo Go fails, use a simulator/emulator instead, or run:
```bash
npx expo run:ios    # macOS only
npx expo run:android
```
