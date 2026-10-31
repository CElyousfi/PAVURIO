/** Pure helpers for the email codes: no Firebase here, so they can be unit-tested. */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export const CODE_TTL_MS = 10 * 60_000;
export const RESEND_GAP_MS = 45_000;
export const MAX_SENDS_PER_HOUR = 5;
export const MAX_ATTEMPTS = 5;

export const normalizeEmail = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : '');
export const isEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
/** codes are stored hashed with a per-record salt (the uid or the email key), never in clear */
export function hashCode(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}
export function keyOf(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 40);
}
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

export type CodeRecord = { email: string; codeHash: string; expiresAt: number; attempts: number; sends: number[] };

/** Can we send another code now? Returns the wait in seconds when not. */
export function sendAllowed(rec: CodeRecord | undefined, now: number): { ok: true } | { ok: false; retryIn: number } {
  if (!rec) return { ok: true };
  const recent = rec.sends.filter((t) => now - t < 3_600_000);
  const last = Math.max(0, ...recent);
  if (last && now - last < RESEND_GAP_MS) return { ok: false, retryIn: Math.ceil((RESEND_GAP_MS - (now - last)) / 1000) };
  if (recent.length >= MAX_SENDS_PER_HOUR) return { ok: false, retryIn: Math.ceil((3_600_000 - (now - Math.min(...recent))) / 1000) };
  return { ok: true };
}

export type CheckResult = 'ok' | 'expired' | 'wrong' | 'locked' | 'missing';
export function checkCode(rec: CodeRecord | undefined, code: unknown, salt: string, now: number): CheckResult {
  if (!rec) return 'missing';
  if (rec.attempts >= MAX_ATTEMPTS) return 'locked';
  if (now > rec.expiresAt) return 'expired';
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) return 'wrong';
  return sameHash(hashCode(code.trim(), salt), rec.codeHash) ? 'ok' : 'wrong';
}

const T = {
  en: {
    verifySubject: (c: string) => `${c} is your Pavurio code`,
    resetSubject: (c: string) => `${c} is your Pavurio password reset code`,
    verifyLead: 'Use this code to confirm your email and keep your pets safe in your Pavurio account:',
    resetLead: 'Use this code to choose a new password for your Pavurio account:',
    expires: 'It expires in 10 minutes. If you didn’t ask for it, you can ignore this email.',
  },
  fr: {
    verifySubject: (c: string) => `${c} est votre code Pavurio`,
    resetSubject: (c: string) => `${c} est votre code pour changer de mot de passe Pavurio`,
    verifyLead: 'Saisissez ce code pour confirmer votre e-mail et garder vos animaux à l’abri dans votre compte Pavurio :',
    resetLead: 'Saisissez ce code pour choisir un nouveau mot de passe pour votre compte Pavurio :',
    expires: 'Il expire dans 10 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.',
  },
};

export function codeEmail(kind: 'verify' | 'reset', code: string, lang: unknown) {
  const t = lang === 'fr' ? T.fr : T.en;
  const subject = kind === 'verify' ? t.verifySubject(code) : t.resetSubject(code);
  const lead = kind === 'verify' ? t.verifyLead : t.resetLead;
  const html = `<!doctype html><html><body style="margin:0;background:#FFF6E6;font-family:Nunito,Helvetica,Arial,sans-serif;color:#23304A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:460px;background:#ffffff;border-radius:24px;padding:28px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:22px;font-weight:900;padding-bottom:8px">Pavurio 🐾</td></tr>
<tr><td style="font-size:16px;line-height:24px;color:#3D4A63;padding-bottom:18px">${lead}</td></tr>
<tr><td align="center" style="font-size:38px;font-weight:900;letter-spacing:10px;background:#DDF6F7;color:#0E8F99;border-radius:16px;padding:18px 0">${code}</td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#7C8494;padding-top:18px">${t.expires}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${lead}\n\n${code}\n\n${t.expires}`;
  return { subject, html, text };
}
