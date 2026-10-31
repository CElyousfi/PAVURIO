# Privacy Policy

*Last updated: 31 October 2026*

Pavurio is a pet-care tracker. This policy explains what the app stores, where, and how to delete it. In short: **your pet data lives on your phone, a backup copy is kept in your Pavurio account so you can restore it, and we never sell data or show ads.**

## What Pavurio stores

**What you enter.** Your pets (name, species, look, birthday, adoption day), care you log, routines and reminders, vet visits, weights, health records, moments (titles and captions) and app settings.

- It is saved **on your phone**.
- A **backup copy** is saved in your Pavurio account (Google Firebase Cloud Firestore) so you can get it back after changing or resetting your phone. It is linked to your account and readable only by you.

**Photos and attachments** you add to records and moments stay **on your phone only**. They are not uploaded.

**Your account (Firebase Authentication).**

- Every installation gets a random account ID automatically, so your data is backed up from the start.
- If you choose to save your account, we also store the **email address** of the sign-in you pick: Google, Sign in with Apple, or email and password.
- Email addresses used with a password are confirmed with a 6-digit code that we email to you. The code is stored only in scrambled (hashed) form and expires after 10 minutes. Password resets work the same way.
- With Sign in with Apple you can hide your email; Apple then gives us a private relay address.
- We don't ask for your name.

**Crash reports (Firebase Crashlytics).**

- If the app crashes, a report with technical details is sent: device model, system and app version, and what the app was doing.
- It is linked to the random account ID, never to your pet data.
- You can turn this off in **Settings → Account → Share crash reports**.

**Purchases.**

- Pavurio Pro is bought through the App Store or Google Play; we never see your payment details.
- To know whether Pro is active, we use **RevenueCat**, which receives your random account ID and your purchase receipts.

**Emails from us.**

- We send account emails: sign-in codes and password-reset codes.
- We send tips and news **only if you tick the box** when you create your account. You can unsubscribe from any newsletter with one click.
- Emails are sent through **Resend**, which receives your email address and the message.

**Notifications.** Reminders are scheduled on your phone; no reminder content is sent to us.

## What Pavurio does not do

- No advertising and no ad SDKs.
- No selling or sharing of personal data.
- No tracking across other apps or websites.
- No analytics SDK. Pavurio does not give medical advice.

## Who processes data for us

| Service | Purpose | Data |
|---|---|---|
| Google Firebase (Authentication, Cloud Firestore, Cloud Functions, Crashlytics) | account, email codes, backup, crash reports | account ID, sign-in email, newsletter choice, backup copy, crash reports |
| Resend | sending code emails and, if you opt in, the newsletter | email address, message content |
| RevenueCat | checking Pavurio Pro | account ID, purchase receipts |
| Apple / Google | sign-in, payments, app distribution | as described in their own policies |

These providers may process data outside your country (for example in the United States) under their standard data-protection terms.

## How long we keep it

- Your backup and account are kept while your account exists.
- Crash reports are kept by Crashlytics for up to 90 days.
- Deleting your account removes your account and your backup immediately.

## Delete your data

- **In the app:** Settings → Account → **Delete account**. This deletes your account, your backup and the data on your phone.
- **Without the app:** see [Delete your account](delete-account.html).
- **Data on your phone only:** Settings → Your data → Erase everything, or delete the app.
- **Export:** you can export everything at any time (Settings → Your data → CSV / JSON).

## Your rights

You can ask to access, correct, export or delete your personal data, or object to its use, by writing to **lesepavistespro@gmail.com**. If you are in the EU/EEA or UK, you can also complain to your data-protection authority.

## Children

Pavurio is not directed at children under 13 (16 in the EU), and we do not knowingly collect their data.

## Changes

We will update this page and its date if anything changes. Important changes will also be shown in the app.

**Contact:** lesepavistespro@gmail.com
