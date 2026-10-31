/**
 * Pavurio Cloud Functions (europe-west1): 6-digit email codes sent with Resend.
 *
 *   sendEmailCode    signed-in user → code to the email on their account
 *   verifyEmailCode  {code, marketing} → marks the email verified (+ newsletter opt-in)
 *   sendResetCode    {email} → password-reset code (silent if no such account)
 *   resetPassword    {email, code, password} → new password, email verified
 *   setMarketing     {optIn} → newsletter consent for Google / Apple accounts
 *
 * Config:  firebase functions:secrets:set RESEND_API_KEY
 *          MAIL_FROM / RESEND_SEGMENT_ID in functions/.env (see .env.example)
 * Codes are stored hashed (users can't read them: firestore.rules denies the collections).
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { CODE_TTL_MS, type CodeRecord, checkCode, codeEmail, hashCode, isEmail, keyOf, newCode, normalizeEmail, sendAllowed } from './logic';

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const MAIL_FROM = defineString('MAIL_FROM', { default: 'Pavurio <hello@pavurio.com>' });
const RESEND_SEGMENT_ID = defineString('RESEND_SEGMENT_ID', { default: '' });
/** reject calls without a valid App Check token. Turn on (functions/.env) once store builds are out. */
const ENFORCE_APP_CHECK = defineBoolean('ENFORCE_APP_CHECK', { default: false });

const db = () => getFirestore();
const opts = { secrets: [RESEND_API_KEY], enforceAppCheck: ENFORCE_APP_CHECK };
const plain = { enforceAppCheck: ENFORCE_APP_CHECK };

function uidOf(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}

async function resend(path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${RESEND_API_KEY.value()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function mail(to: string, m: { subject: string; html: string; text: string }) {
  const r = await resend('/emails', 'POST', { from: MAIL_FROM.value(), to: [to], subject: m.subject, html: m.html, text: m.text });
  if (!r.ok) {
    logger.error('resend send failed', { status: r.status, body: await r.text() });
    throw new HttpsError('unavailable', 'The email could not be sent. Try again in a moment.');
  }
}

/** newsletter consent → Resend contact (+ segment). Never blocks sign-up if Resend is down. */
async function syncContact(email: string, optIn: boolean) {
  try {
    let r = await resend('/contacts', 'POST', { email, unsubscribed: !optIn });
    if (!r.ok) r = await resend(`/contacts/${encodeURIComponent(email)}`, 'PATCH', { unsubscribed: !optIn });
    const seg = RESEND_SEGMENT_ID.value();
    if (optIn && seg) await resend(`/contacts/${encodeURIComponent(email)}/segments/${seg}`, 'POST');
  } catch (e) {
    logger.warn('resend contact sync failed', e as Error);
  }
}

async function saveProfile(uid: string, email: string, patch: Record<string, unknown>) {
  await db().doc(`profiles/${uid}`).set({ email, updatedAt: FieldValue.serverTimestamp(), ...patch }, { merge: true });
}

/** stores a fresh code for `ref` (rate-limited) and returns it */
async function issue(ref: FirebaseFirestore.DocumentReference, email: string, salt: string): Promise<string> {
  const code = newCode();
  await db().runTransaction(async (tx) => {
    const now = Date.now();
    const rec = (await tx.get(ref)).data() as CodeRecord | undefined;
    const allowed = sendAllowed(rec && rec.email === email ? rec : rec ? { ...rec, attempts: 0 } : undefined, now);
    if (!allowed.ok) throw new HttpsError('resource-exhausted', 'Please wait before asking for another code.', { retryIn: allowed.retryIn });
    const sends = [...(rec?.sends ?? []).filter((t) => now - t < 3_600_000), now];
    tx.set(ref, { email, codeHash: hashCode(code, salt), expiresAt: now + CODE_TTL_MS, attempts: 0, sends } satisfies CodeRecord);
  });
  return code;
}

/** checks a code (counting the attempt) and deletes it when it matches */
async function redeem(ref: FirebaseFirestore.DocumentReference, code: unknown, salt: string, email?: string) {
  const result = await db().runTransaction(async (tx) => {
    const rec = (await tx.get(ref)).data() as CodeRecord | undefined;
    const r = rec && email && rec.email !== email ? 'missing' : checkCode(rec, code, salt, Date.now());
    if (r === 'ok') tx.delete(ref);
    else if (r === 'wrong' && rec) tx.update(ref, { attempts: rec.attempts + 1 });
    return r;
  });
  if (result === 'ok') return;
  const msg: Record<string, string> = {
    wrong: 'That code isn’t right. Check the email and try again.',
    expired: 'That code has expired. Ask for a new one.',
    locked: 'Too many tries. Ask for a new code.',
    missing: 'Ask for a code first.',
  };
  throw new HttpsError(result === 'wrong' ? 'invalid-argument' : 'failed-precondition', msg[result], { reason: result });
}

export const sendEmailCode = onCall(opts, async (req) => {
  const uid = uidOf(req);
  const user = await getAuth().getUser(uid);
  const email = normalizeEmail(user.email);
  if (!email) throw new HttpsError('failed-precondition', 'This account has no email yet.');
  if (user.emailVerified) return { verified: true };
  const code = await issue(db().doc(`emailCodes/${uid}`), email, uid);
  await mail(email, codeEmail('verify', code, req.data?.lang));
  return { sent: true, email };
});

export const verifyEmailCode = onCall(plain, async (req) => {
  const uid = uidOf(req);
  const user = await getAuth().getUser(uid);
  const email = normalizeEmail(user.email);
  if (!email) throw new HttpsError('failed-precondition', 'This account has no email yet.');
  await redeem(db().doc(`emailCodes/${uid}`), req.data?.code, uid, email);
  await getAuth().updateUser(uid, { emailVerified: true });
  const optIn = req.data?.marketing === true;
  await saveProfile(uid, email, { verifiedAt: FieldValue.serverTimestamp(), marketing: { optIn, at: FieldValue.serverTimestamp(), source: 'email-signup' } });
  if (optIn) await syncContact(email, true);
  return { verified: true };
});

export const sendResetCode = onCall(opts, async (req) => {
  const email = normalizeEmail(req.data?.email);
  if (!isEmail(email)) throw new HttpsError('invalid-argument', 'That email address doesn’t look right.');
  const key = keyOf(email);
  const code = await issue(db().doc(`resetCodes/${key}`), email, key);
  let exists = true;
  try {
    await getAuth().getUserByEmail(email);
  } catch {
    exists = false; // same answer either way: nobody can probe which emails have an account
  }
  if (exists) await mail(email, codeEmail('reset', code, req.data?.lang));
  return { sent: true };
});

export const resetPassword = onCall(plain, async (req) => {
  const email = normalizeEmail(req.data?.email);
  const password = typeof req.data?.password === 'string' ? req.data.password : '';
  if (!isEmail(email)) throw new HttpsError('invalid-argument', 'That email address doesn’t look right.');
  if (password.length < 6) throw new HttpsError('invalid-argument', 'Use at least 6 characters for the password.');
  const key = keyOf(email);
  await redeem(db().doc(`resetCodes/${key}`), req.data?.code, key, email);
  let uid: string;
  try {
    uid = (await getAuth().getUserByEmail(email)).uid;
  } catch {
    throw new HttpsError('not-found', 'That code isn’t right. Check the email and try again.');
  }
  await getAuth().updateUser(uid, { password, emailVerified: true });
  return { ok: true };
});

export const setMarketing = onCall(opts, async (req) => {
  const uid = uidOf(req);
  const user = await getAuth().getUser(uid);
  const email = normalizeEmail(user.email);
  if (!email) throw new HttpsError('failed-precondition', 'This account has no email yet.');
  const optIn = req.data?.optIn === true;
  await saveProfile(uid, email, { marketing: { optIn, at: FieldValue.serverTimestamp(), source: req.data?.source ?? 'settings' } });
  await syncContact(email, optIn);
  return { optIn };
});
