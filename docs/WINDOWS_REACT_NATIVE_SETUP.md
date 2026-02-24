# React Native Windows Development Setup Guide

A complete guide for setting up and running React Native projects on Windows with a physical Android device.

---

## Prerequisites

### Required Software

| Software | Purpose | Download |
|----------|---------|----------|
| Node.js 20+ | JavaScript runtime | https://nodejs.org |
| Android Studio | Android SDK, NDK, emulator | https://developer.android.com/studio |
| Git | Version control | https://git-scm.com |

### Android Studio Setup

After installing Android Studio:

1. Open Android Studio → **SDK Manager** (or Settings → Languages & Frameworks → Android SDK)
2. **SDK Platforms** tab: Install Android 14 (API 34) or latest
3. **SDK Tools** tab: Install:
   - Android SDK Build-Tools
   - Android SDK Platform-Tools (includes `adb`)
   - Android NDK (Side by side)
   - Android SDK Command-line Tools

The SDK is installed at: `C:\Users\{USERNAME}\AppData\Local\Android\Sdk`

---

## Environment Variables

### Required Variables

These must be set in every terminal session (or permanently in System Environment Variables):

```cmd
:: Java (use Android Studio's bundled JDK)
set JAVA_HOME=F:\ClaudeProjects\Android_Studio\jbr
:: Or if installed in default location:
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr

:: Android SDK
set ANDROID_HOME=C:\Users\{USERNAME}\AppData\Local\Android\Sdk

:: Add to PATH
set PATH=%PATH%;%JAVA_HOME%\bin
set PATH=%PATH%;%ANDROID_HOME%\platform-tools
set PATH=%PATH%;%ANDROID_HOME%\emulator
```

### Making Variables Permanent

1. Press `Win + R` → type `sysdm.cpl` → Enter
2. Go to **Advanced** tab → **Environment Variables**
3. Under "User variables", click **New** and add:
   - `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`
   - `ANDROID_HOME` = `C:\Users\{USERNAME}\AppData\Local\Android\Sdk`
4. Edit **Path** and add:
   - `%JAVA_HOME%\bin`
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`

---

## Project Setup

### 1. Create local.properties

Every React Native Android project needs a `local.properties` file in the `android/` folder:

**File: `android/local.properties`**
```properties
sdk.dir=C:\\Users\\{USERNAME}\\AppData\\Local\\Android\\Sdk
```

Note: Use double backslashes `\\` for Windows paths.

### 2. Gradle Version

React Native 0.83+ requires specific Gradle versions. Check `android/gradle/wrapper/gradle-wrapper.properties`:

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
```

**Gradle Version Compatibility:**
| React Native | Minimum Gradle | Recommended |
|--------------|----------------|-------------|
| 0.83.x | 8.13 | 8.13 |
| 0.82.x | 8.10.2 | 8.10.2 |
| 0.71-0.81 | 8.3-8.9 | 8.9 |

**Common Error**: `Minimum supported Gradle version is X.XX`
**Fix**: Update `distributionUrl` in `gradle-wrapper.properties`

### 3. Install Dependencies

```cmd
cd mobile-app
npm install
```

---

## Connecting Physical Android Device

### 1. Enable Developer Options

On your Android phone:
1. Go to **Settings → About Phone**
2. Tap **Build Number** 7 times
3. Go back to **Settings → Developer Options**
4. Enable **USB Debugging**

### 2. Connect via USB

1. Connect phone to PC with USB cable
2. On phone, tap **Allow** when prompted for USB debugging
3. Check "Always allow from this computer"

### 3. Verify Connection

```cmd
adb devices
```

Expected output:
```
List of devices attached
2a55d2b422057ece        device
```

**Troubleshooting:**
| Status | Meaning | Fix |
|--------|---------|-----|
| `device` | Connected and authorized | Ready to use |
| `unauthorized` | Needs permission | Check phone for popup, tap Allow |
| `offline` | Connection issue | Unplug and replug USB cable |
| (empty) | Not detected | Try different USB cable/port, check USB debugging enabled |

---

## Running the App

### Two-Terminal Workflow

**Terminal 1: Metro Bundler**
```cmd
cd F:\ClaudeProjects\GroceryApp\mobile-app
npx react-native start
```

**Terminal 2: Build and Install**
```cmd
:: Set environment (if not permanent)
set JAVA_HOME=F:\ClaudeProjects\Android_Studio\jbr
set PATH=%PATH%;%JAVA_HOME%\bin;C:\Users\Shahir\AppData\Local\Android\Sdk\platform-tools

:: Navigate to project
cd /d F:\ClaudeProjects\GroceryApp\mobile-app

:: Build and install
npx react-native run-android
```

### First Build

The first build takes 5-15 minutes because it:
1. Downloads Gradle distribution
2. Downloads Android SDK components (NDK, build tools)
3. Compiles all native modules
4. Builds the APK
5. Installs on device

Subsequent builds are much faster (30-60 seconds).

---

## Common Errors and Fixes

### JAVA_HOME Not Set

**Error:**
```
ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
```

**Fix:**
```cmd
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%PATH%;%JAVA_HOME%\bin
```

### adb Not Recognized

**Error:**
```
'adb' is not recognized as an internal or external command
```

**Fix:**
```cmd
set PATH=%PATH%;C:\Users\{USERNAME}\AppData\Local\Android\Sdk\platform-tools
```

### SDK Location Not Found

**Error:**
```
SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable
or by setting the sdk.dir path in your project's local properties file
```

**Fix:** Create `android/local.properties`:
```properties
sdk.dir=C:\\Users\\{USERNAME}\\AppData\\Local\\Android\\Sdk
```

### Gradle Version Mismatch

**Error:**
```
Minimum supported Gradle version is 8.13. Current version is 8.10.2.
```

**Fix:** Edit `android/gradle/wrapper/gradle-wrapper.properties`:
```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
```

### Gradle Cache Corruption

**Error:**
```
java.io.UncheckedIOException: Could not move temporary workspace
```

**Fix:**
```cmd
cd android
rmdir /s /q .gradle
cd ..
npx react-native run-android
```

### cd Doesn't Change Drives

**Error:** Running `cd F:\...` from C: drive doesn't work

**Fix:** Use `/d` flag or switch drives first:
```cmd
:: Option 1: Use /d flag
cd /d F:\ClaudeProjects\GroceryApp\mobile-app

:: Option 2: Switch drive first
F:
cd F:\ClaudeProjects\GroceryApp\mobile-app
```

---

## Quick Reference Commands

### Verify Setup

```cmd
:: Check Java
java -version

:: Check ADB
adb devices

:: Check Node
node -v

:: Check environment variables
echo %JAVA_HOME%
echo %ANDROID_HOME%
```

### Build Commands

```cmd
:: Debug build + install
npx react-native run-android

:: Just build APK (no install)
cd android
.\gradlew.bat assembleDebug
cd ..

:: Release APK
cd android
.\gradlew.bat assembleRelease
cd ..

:: Clean build cache
cd android
.\gradlew.bat clean
cd ..
```

### Metro Bundler

```cmd
:: Start Metro
npx react-native start

:: Start with clean cache
npx react-native start --reset-cache
```

### Device Commands

```cmd
:: List connected devices
adb devices

:: View app logs
adb logcat *:S ReactNative:V ReactNativeJS:V

:: Restart ADB server
adb kill-server
adb start-server

:: Install APK manually
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Project-Specific Files Checklist

Before building, ensure these files exist and are configured:

| File | Purpose | Required |
|------|---------|----------|
| `android/local.properties` | SDK path | Yes |
| `android/gradle/wrapper/gradle-wrapper.properties` | Gradle version | Yes |
| `android/app/google-services.json` | Firebase config | If using Firebase |
| `.env` | Environment variables | If app uses env vars |

---

## Complete Setup Script

Save this as `setup-android-env.cmd` and run it at the start of each terminal session:

```cmd
@echo off
echo Setting up Android development environment...

:: Java (Android Studio bundled JDK)
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr

:: Android SDK
set ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk

:: Add to PATH
set PATH=%PATH%;%JAVA_HOME%\bin
set PATH=%PATH%;%ANDROID_HOME%\platform-tools
set PATH=%PATH%;%ANDROID_HOME%\emulator

:: Verify
echo.
echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%
echo.
java -version 2>&1 | findstr /i "version"
adb version 2>&1 | findstr /i "version"
echo.
echo Environment ready!
```

---

## Firebase Setup (Optional)

If your project uses Firebase:

1. Create a Firebase project at https://console.firebase.google.com
2. Add an Android app with your package name (e.g., `com.groceryapp.mobile`)
3. Download `google-services.json`
4. Place it in `android/app/google-services.json`

---

## Summary: First-Time Setup Steps

1. **Install Prerequisites**: Node.js, Android Studio, Git
2. **Configure Android Studio**: Install SDK Platform 34, Platform-Tools, NDK
3. **Set Environment Variables**: JAVA_HOME, ANDROID_HOME, PATH
4. **Create local.properties**: Point to Android SDK
5. **Enable USB Debugging**: On your Android phone
6. **Connect Phone**: Via USB, allow debugging
7. **Install Dependencies**: `npm install`
8. **Start Metro**: `npx react-native start` (Terminal 1)
9. **Build and Run**: `npx react-native run-android` (Terminal 2)
10. **Wait**: First build takes 5-15 minutes

---

## Summary: Subsequent Runs

```cmd
:: Terminal 1
cd /d F:\ClaudeProjects\GroceryApp\mobile-app
npx react-native start

:: Terminal 2
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%PATH%;%JAVA_HOME%\bin;%LOCALAPPDATA%\Android\Sdk\platform-tools
cd /d F:\ClaudeProjects\GroceryApp\mobile-app
npx react-native run-android
```

Or make environment variables permanent and just run:
```cmd
npx react-native start        # Terminal 1
npx react-native run-android  # Terminal 2
```
