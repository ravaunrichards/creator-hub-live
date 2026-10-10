# Android Releases — Creator Hub Creator Network

No APK is included in this corrected source ZIP. The two APKs in the supplied archive were excluded because their installability, provenance, and update-signing compatibility were not independently verified. The signing keystore was excluded because signing material is sensitive and was present in the supplied archive.

## Build a debug APK
1. Open `android/` in Android Studio.
2. Install the Android SDK required by the project and compatible Gradle tooling.
3. Build and install a debug APK.
4. Test login, navigation, file picker, camera/microphone permission, LiveKit LIVE, and reconnect behavior on a physical device.

## Build a release APK
1. Confirm whether the app is already published in Google Play and identify its official signing configuration.
2. Use the existing official upload/signing process, not the excluded archive keystore.
3. Keep store passwords and keystore files outside source control.
4. Test an update over the currently published version if applicable.
5. Verify the final APK signature and install/launch it on a test device before distributing it.

The supplied archive environment had no Gradle wrapper, installed Gradle, or Android SDK, so no APK build was performed as part of this repair.
