# Pavurio — launch checklist (what only the owner can do)

The code is ready. These steps need your accounts. Each one says what to send back to Claude, if anything.

## 1. Website (1 minute)

1. Open GitHub → **CElyousfi/PAVURIO** → **Settings → Pages**.
2. Under **Source**, choose **Deploy from a branch**, then branch `gh-pages`, folder `/ (root)`, and click **Save**.
3. Within a minute, https://celyousfi.github.io/PAVURIO/ is live. The privacy, terms, support and account-deletion pages are in English and French. The app already links to them.

## 2. Firebase: accounts, email codes, backup and crash reports (about 25 minutes)

1. Go to https://console.firebase.google.com → **Add project** → name it `Pavurio`. You can turn Google Analytics off: the app doesn't use it.

2. **Build → Authentication → Get started → Sign-in method.** Enable:
   - **Anonymous**: this is the guest account everyone gets on first launch.
   - **Email/Password**.
   - **Google**: choose a support email.
   - **Apple**: just enable it; nothing else is needed for the iPhone app.

3. **Build → Firestore Database → Create database**:
   - Choose **Production mode**.
   - Pick a location close to your users (`eur3` for Europe), then confirm.
   - Open the **Rules** tab, paste the content of `firestore.rules` from the repo, and click **Publish**.

4. **Release & Monitor → Crashlytics → Get started.**

5. **Project settings (gear) → Your apps**:
   - Add an **iOS app** with bundle ID `com.pavurio.app` → download **GoogleService-Info.plist**.
   - Add an **Android app** with package `com.pavurio.app` → download **google-services.json**.
   - Google sign-in on Android also needs the **SHA-1** fingerprints:
     - Your upload key: run `npx eas-cli credentials` → Android → production → it shows the SHA-1.
     - Later, the **App signing key** from Play Console → Setup → App signing.
     - Add both under the Android app in Firebase, then download `google-services.json` again.

6. **Send both files to Claude.** Or put them in the repo's `firebase/` folder. Accounts, backup and Crashlytics switch on automatically in the next build.

7. **Switch to the Blaze plan.** The 6-digit email codes need it.
   - In the Firebase console, open **Upgrade** → **Blaze (pay as you go)** and add a card.
   - Set a **budget alert** (for example €5) so you're warned before anything is charged.
   - At Pavurio's size the cost is **€0**: Cloud Functions include 2 million free calls per month.

8. **Resend, which sends the code emails.**
   - In https://resend.com, add and verify a domain for Pavurio, such as `pavurio.app` or `mail.pavurio.app`. That means adding the DNS records Resend shows you.
   - Your Resend account currently has only `mail.syndicup.pro`. Don't send Pavurio emails from it: people won't recognise the sender and the emails may land in spam.
   - Create an **API key** with sending access.
   - Optional: create a segment called "Pavurio newsletter". People who tick the newsletter box are added to it.
   - The free Resend plan covers 3,000 emails a month (100 a day).

9. **Deploy the functions.** Claude can do this once you're logged in, or you can run:
   ```
   cd functions && npm install
   cp .env.example .env        # set MAIL_FROM="Pavurio <hello@your-domain>" and RESEND_SEGMENT_ID
   npx firebase-tools login
   npx firebase-tools use --add                     # pick the Pavurio project
   npx firebase-tools functions:secrets:set RESEND_API_KEY
   npx firebase-tools deploy --only functions,firestore:rules
   ```

**What stays free:**
- Authentication.
- Firestore: 1 GiB of storage, 50k reads and 20k writes per day. That's enough for thousands of users, because a backup is a few documents.
- Crashlytics.

Photos are not uploaded, so no Cloud Storage is needed (Cloud Storage would require the paid plan).

## 3. Payments with RevenueCat (about 20 minutes, after the store products exist)

1. **Create the products in the stores.**
   - **App Store Connect → your app → Subscriptions:** a group "Pavurio Pro" with `pavurio_pro_yearly` (7-day free trial introductory offer) and `pavurio_pro_monthly`.
   - **In-App Purchases:** `pavurio_pro_lifetime` (non-consumable).
   - **Google Play Console:** create the same three products (two subscriptions with base plans, plus one in-app product).

2. **Set up RevenueCat** at https://app.revenuecat.com:
   - Create a project and add the iOS and Android apps. RevenueCat asks for an App Store Connect API key and a Google Play service account; it shows how.
   - Import the products.
   - Create the entitlement **`pro`** and attach all three products.
   - Create the offering **`default`** with the packages Annual, Monthly and Lifetime.

3. **Send Claude the two public SDK keys:**
   - Project settings → API keys → the **Apple** key (starts with `appl_`) and the **Google** key (starts with `goog_`).
   - They go in as `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`, set as EAS environment variables.

## 4. First builds (EAS)

```
npx eas-cli login
npx eas-cli init                         # links the project, once
npx eas-cli build --profile preview -p android    # installable APK for your phone
npx eas-cli build --profile development -p ios    # needs your Apple developer account
npx eas-cli build --profile production -p all     # store builds
npx eas-cli submit -p ios / -p android            # uploads to the stores
```

On your phone, check:

- Notifications, including the Done and Snooze buttons on a reminder.
- Sign in with Apple and Google.
- Restore on a second phone.
- A sandbox purchase, then Restore purchases.
- Crashlytics: the first crash report appears in the console within minutes.

## 5. Store listings

Everything to paste is in `docs/store/LISTING.md`: names, descriptions in English and French, keywords, the privacy answers for Apple and the Data safety answers for Google, the review notes, and the product IDs. The screenshots, feature graphic and icons are in `docs/store/`.
