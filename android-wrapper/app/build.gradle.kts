plugins { id("com.android.application") }

val websiteUrl = (project.findProperty("chcnWebsiteUrl") as String?)
    ?: System.getenv("CHCN_WEBSITE_URL")
    ?: "https://creator-hub-live-frontend.onrender.com"
val ksB64 = System.getenv("ANDROID_KEYSTORE_BASE64")
val ksPassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val keyAlias = System.getenv("ANDROID_KEY_ALIAS")
val keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
val releaseKeyFile = layout.buildDirectory.file("release/chcn-release.jks")

android {
    namespace = "com.creatorhub.creatornetwork"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.creatorhub.creatornetwork"
        minSdk = 23
        targetSdk = 35
        versionCode = 410
        versionName = "4.1.0"
        buildConfigField("String", "WEBSITE_URL", "\"${websiteUrl.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
    }
    buildFeatures { buildConfig = true }
    signingConfigs {
        if (!ksB64.isNullOrBlank() && !ksPassword.isNullOrBlank() && !keyAlias.isNullOrBlank() && !keyPassword.isNullOrBlank()) {
            create("release") {
                val file = releaseKeyFile.get().asFile
                file.parentFile.mkdirs()
                if (!file.exists()) file.writeBytes(java.util.Base64.getDecoder().decode(ksB64))
                storeFile = file
                storePassword = ksPassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            }
        }
    }
    buildTypes {
        debug { applicationIdSuffix = ".debug"; versionNameSuffix = "-debug" }
        release {
            isMinifyEnabled = false
            if (!ksB64.isNullOrBlank() && !ksPassword.isNullOrBlank() && !keyAlias.isNullOrBlank() && !keyPassword.isNullOrBlank()) signingConfig = signingConfigs.getByName("release")
            else { // CI can still build the automatically debug-signed testing APK.
                signingConfig = signingConfigs.getByName("debug")
            }
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
