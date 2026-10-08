# Creator Hub Creator Network — Releases

## Supplied APKs

`releases/creator-hub-live-release.apk` and `releases/creator-hub-live-release-alt.apk` are byte-for-byte identical.

SHA-256:
`b061a97bced2b20d5115fe5bf93b780f30e37d37d8d5bc59a944b9a706e29a0a`

Certificate SHA-256:
`1D:DE:83:C9:77:CE:3A:D7:E7:EE:FF:DA:7C:AD:B0:B0:80:E4:33:CD:0F:11:14:89:A8:34:E1:91:41:EA:FE:46`

## Repository keystore

Certificate SHA-256:
`B6:84:18:EC:AE:2F:31:EA:25:11:AF:55:C9:E6:01:5B:69:2A:1F:04:D0:E3:ED:88:8C:2C:D3:BB:E7:DB:03:4C`

The mismatch means the existing APKs were not treated as the repaired release.

## Required final artifact

`releases/creator-hub-app-release.apk` must only be created after an actual `assembleRelease` build and signature/install verification. It was **not fabricated** in this snapshot because the Gradle wrapper/Android SDK were unavailable.
