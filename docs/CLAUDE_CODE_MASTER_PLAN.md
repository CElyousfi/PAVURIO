# Pavurio: master plan for Claude Code (local machine)

Goal: take Pavurio from "code ready" (branch `feat/accounts-sync-launch`, PR #7) to **installable test builds on a phone with accounts, email codes, backup and crash reports working**. The store submission is prepared, but nothing is submitted until the owner says so.

The owner is present. Work phase by phase. **Stop and ask** only when a step needs the owner's browser, card, password or a key. Before each phase, say in one line what you are about to do. After each phase, tick it off in a short status message.

## Ground rules

- Read first: `docs/LAUNCH.md`, `app.config.ts`, `firebase.json`, `firestore.rules`, `functions/src/*.ts`, `src/cloud/*`, `src/state/Cloud.tsx`, `src/app/account.tsx`, `AGENTS.md`.
- Expo SDK 58, React Native 0.88, React Native Firebase 27.
  - Use `npx expo install` for app dependencies.
  - Never hand-edit `ios/` or `android/`; they are generated.
  - Native config goes through `app.config.ts` / `app.json` plugins only.
- **Never commit secrets**: Resend API key, `functions/.env`, RevenueCat secret keys, Apple .p8, keystores.
  - Firebase client config files (`firebase/GoogleService-Info.plist`, `firebase/google-services.json`) **are** committed. They are public identifiers.
  - Public RevenueCat SDK keys go into EAS environment variables, not git.
- **Art rule:** don't draw or alter pet art. Only the owner's art, delivered by ChatGPT/Gemini, is used.
- **Commits:**
  - Use `git -c user.name="CElyousfi" -c user.email="lesepavistespro@gmail.com" commit`.
  - End messages with `Co-Authored-By: Claude <noreply@anthropic.com>`.
  - Push to `feat/accounts-sync-launch`. Do not merge into `main` until Phase 9.
- **After every code change**, run `npm run typecheck && npm run lint && npm test` and `cd functions && npm test`. All must pass.

## Phase 0: Tools

1. Check: `node -v` (22+), `git`, `gh auth status`, `npx -y firebase-tools@latest --version`, and `npx -y eas-cli@latest --version`.
2. Install the Firebase MCP if it's missing: `claude mcp add firebase npx -- -y firebase-tools@latest mcp`.
3. Log in to Firebase: `npx firebase-tools login`. Log in to Expo: `npx eas-cli login`. The owner may need to sign in for either.
4. Prepare the repo: `git checkout feat/accounts-sync-launch && git pull && npm ci && (cd functions && npm ci)`.

## Phase 1: Firebase project and apps

1. Use the **Pavurio** project on the Blaze plan. Find it with `firebase projects:list`. Write `.firebaserc` with it as `default`.
2. Register the iOS app (`com.pavurio.app`) and the Android app (`com.pavurio.app`) if they don't exist yet. Use `firebase apps:create` or the MCP.
3. Download the config files:
   - `firebase apps:sdkconfig IOS <appId> -o firebase/GoogleService-Info.plist`
   - `firebase apps:sdkconfig ANDROID <appId> -o firebase/google-services.json`
4. Check that `npx expo config --type public` shows `extra.firebase: true`.

## Phase 2: Firestore, Auth, Crashlytics

1. Create the Firestore database (Native mode, location `eur3`) if it doesn't exist. Deploy the rules: `npx firebase-tools deploy --only firestore:rules`.
2. **Authentication.** Enable these providers: **Anonymous, Email/Password, Google, Apple.**
   - If the CLI or MCP can't toggle them, give the owner the exact console clicks (Authentication → Sign-in method) and wait for "done".
   - Also check Authentication → Settings → **User account linking** is set to "Link accounts that use the same email".
3. **Android Google sign-in fingerprints:**
   - Run `npx eas-cli credentials -p android` (profile production). Create the keystore if asked, and take its SHA-1 and SHA-256.
   - Add both to the Android app in Firebase, then download `google-services.json` again.
   - The Play App Signing SHA keys are added later, after the first Play upload (see Phase 8).
4. **Crashlytics:** ask the owner to open Release & Monitor → Crashlytics once so it's enabled.

## Phase 3: Email domain (Resend)

The codes must come from a Pavurio domain. Don't use `syndicup.pro`.

1. Ask the owner which domain to use. The recommendation is `pavurio.com`, which they may already have bought.
2. Have them add it in **Resend → Domains** (region eu-west-1). Then add the DNS records Resend shows (SPF, DKIM, and MX for the `send` subdomain) wherever the domain's DNS lives, for example Vercel → Domains → DNS. You can do this with the `vercel` CLI if it's logged in.
3. Wait until Resend shows the domain as **Verified**.
4. Ask the owner for a **Resend API key** with sending access only.
5. Optional: create a Resend segment called "Pavurio newsletter" and note its ID.

## Phase 4: Cloud Functions

1. Create `functions/.env`, which is gitignored:
   - `MAIL_FROM="Pavurio <hello@<domain>>"`
   - `RESEND_SEGMENT_ID="<id or empty>"`
2. Store the key as a secret: `npx firebase-tools functions:secrets:set RESEND_API_KEY`. The owner pastes the key.
3. Deploy: `cd functions && npm test && cd .. && npx firebase-tools deploy --only functions`.
4. Check: `npx firebase-tools functions:list` shows `sendEmailCode`, `verifyEmailCode`, `sendResetCode`, `resetPassword` and `setMarketing` in **europe-west1**.
5. **Smoke test** with a throwaway script that is not committed: use the Firebase Admin SDK, or the Functions shell `npx firebase-tools functions:shell`.
   - Call `sendResetCode({ email: "<owner's email>" })`. The owner confirms that the code email arrives, looks right and is not in spam.
   - If it's in spam, check DMARC: add `_dmarc` TXT `v=DMARC1; p=none;` for the domain.
6. **Budget:** confirm with the owner that a budget alert exists (Billing → Budgets & alerts, about €5).

## Phase 5: Website (GitHub Pages)

1. Enable Pages from the `gh-pages` branch:

   ```
   gh api -X POST repos/CElyousfi/PAVURIO/pages -f "source[branch]=gh-pages" -f "source[path]=/"
   ```

   If the API refuses, the owner does it in Settings → Pages.
2. Check that these return 200: https://pavurio.com/, `/privacy.html`, `/terms.html`, `/support.html`, `/delete-account.html`, plus the same pages under `/fr/`.
3. Optional, if the owner bought a domain:
   - Point `www` or the apex to GitHub Pages (CNAME `celyousfi.github.io`) and add a `CNAME` file on `gh-pages`.
   - Update `SITE` in `src/config/links.ts` and `BASE` in `tools/site/build.py`.
   - Rebuild with `python3 tools/site/build.py` and push `site/dist` to `gh-pages`.

## Phase 6: EAS project and first builds

1. Link the project: `npx eas-cli init`. It writes `extra.eas.projectId` and `owner`, which app.config.ts keeps through `...config`. Commit the change.
2. Set environment variables (`eas env:create`, environment = preview and production):
   - `EXPO_PUBLIC_RC_IOS_KEY` and `EXPO_PUBLIC_RC_ANDROID_KEY`, **only if the owner has the RevenueCat public keys** (appl_… / goog_…). Otherwise skip. The paywall then shows preview prices and purchases are disabled, which is fine for this test.
3. **Android:** `npx eas-cli build --profile preview -p android`. This makes an APK. Send the owner the install link or QR code.
4. **iOS:**
   - Build with `npx eas-cli build --profile preview -p ios`. It needs the owner's Apple Developer login, and the device UDID registered with `eas device:create`.
   - Or use `--profile production` and then `eas submit -p ios` to TestFlight, if the owner prefers TestFlight.
   - Sign in with Apple needs the capability on the App ID; EAS sets it from `usesAppleSignIn`.
5. If a build fails, read the logs and fix the cause in config or plugins, never in generated native folders. Rebuild.
   - Typical suspects: `useFrameworks: "dynamic"` with other pods, the Google Sign-In URL scheme, and Firebase SPM.

## Phase 7: On-device QA with the owner

Walk the owner through each check and record pass/fail. Fix the failures, rebuild and recheck.

1. **First launch:** guest account created. Firebase Auth shows an anonymous user. Onboarding completes, and the dog and cat animate.
2. **Backup:** log 2 cares, wait 20 s or background the app. Firestore shows `users/<uid>` and `backup/*`.
3. **Email sign-up:** Settings → Account → email + password → "Create account".
   - The code email arrives and auto-fill or paste works.
   - The account then shows as saved, and the Auth user's email is verified.
   - Tick the newsletter box and check the contact appears in Resend.
4. **Wrong code:** shows an error. After 5 wrong codes, the code is locked. Resend works after 45 s. "Use another email" works.
5. **Google:** sign-in works on Android and iOS. On iOS, Sign in with Apple works too.
6. **Restore on a second device, or after delete and reinstall:**
   - "I already have an account" → sign in, and the pets and history come back.
   - For an email account that was never verified, the code is asked before anything is restored.
7. **Forgot password:** the code arrives, the new password is saved and the user is signed in.
8. **Sign out:** the phone is cleared and a new guest is created. Sign back in and the data is restored.
9. **Delete account:**
   - Re-authentication is asked when needed.
   - Firestore `users/<uid>` and the Auth user are gone, and the app returns to onboarding.
10. **Notifications:** a routine reminder fires. **Done** from the notification logs the care, and **Snooze** works.
11. **Crashlytics:** a non-fatal error appears in the console. You can trigger one with a temporary debug button that you remove afterwards, or by testing in a dev build.
12. **French:** switch the language to French and spot-check the account, code and paywall screens.

## Phase 8: Store setup (prepare, don't submit)

1. **App Store Connect:**
   - Create the app (`com.pavurio.app`).
   - Fill in the listing from `docs/store/LISTING.md`, with the screenshots from `docs/store/screenshots/*/apple-6.9`.
   - Create the subscription group and products (`pavurio_pro_yearly` with a 7-day trial, `pavurio_pro_monthly`, `pavurio_pro_lifetime`).
   - Fill in the privacy answers from LISTING.md.
2. **Google Play Console:**
   - Create the app and the same 3 products.
   - Fill in the listing, the Data safety form and the account deletion URL. Use `docs/store/screenshots/*/google-play` and `docs/store/graphics/`.
   - After the first upload to internal testing, add the **Play App Signing SHA-1/SHA-256** to the Firebase Android app, re-download `google-services.json`, commit and rebuild.
3. **RevenueCat:**
   - Create the project with entitlement `pro` and offering `default` (Annual, Monthly, Lifetime).
   - Put the public SDK keys into EAS env (Phase 6.2), rebuild, and test a sandbox purchase plus Restore.

## Phase 9: Wrap-up

1. All checks green. Re-run `npm run typecheck && npm run lint && npm test` and the functions tests.
2. Update `docs/LAUNCH.md` with what's done and what's left.
3. Ask the owner for approval, then merge PR #7 into `main`: `gh pr merge 7 --merge`.
4. Final report to the owner, kept short:
   - Done items, with links: builds, Firebase console, the website.
   - Anything waiting on them.
   - Known limits:
     - Photos aren't in the cloud backup.
     - The records scene still shows the v1 cat until ChatGPT redraws it.
     - The next Gemini cat clips are pending.
