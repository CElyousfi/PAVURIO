# Firebase files go here

Put the two files downloaded from the Firebase console in this folder:

- `GoogleService-Info.plist` (Project settings → Your apps → iOS app `com.pavurio.app`)
- `google-services.json` (Project settings → Your apps → Android app `com.pavurio.app`)

`app.config.ts` turns on accounts, cloud backup and Crashlytics only when both are present.
These files hold public client identifiers, not secrets: access is protected by `firestore.rules`.
