import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCode, codeEmail, hashCode, isEmail, newCode, normalizeEmail, sendAllowed, MAX_ATTEMPTS } from './logic';

test('codes are 6 digits and checked against their salted hash', () => {
  for (let i = 0; i < 50; i++) assert.match(newCode(), /^\d{6}$/);
  const rec = { email: 'a@b.co', codeHash: hashCode('123456', 'uid1'), expiresAt: 1_000, attempts: 0, sends: [] };
  assert.equal(checkCode(rec, '123456', 'uid1', 500), 'ok');
  assert.equal(checkCode(rec, ' 123456 ', 'uid1', 500), 'ok');
  assert.equal(checkCode(rec, '123457', 'uid1', 500), 'wrong');
  assert.equal(checkCode(rec, '123456', 'uid2', 500), 'wrong'); // salt binds the code to its account
  assert.equal(checkCode(rec, '123456', 'uid1', 1_001), 'expired');
  assert.equal(checkCode({ ...rec, attempts: MAX_ATTEMPTS }, '123456', 'uid1', 500), 'locked');
  assert.equal(checkCode(undefined, '123456', 'uid1', 500), 'missing');
});

test('sending is rate limited: 45 s apart, 5 per hour', () => {
  const now = 10_000_000;
  assert.deepEqual(sendAllowed(undefined, now), { ok: true });
  const r = sendAllowed({ email: '', codeHash: '', expiresAt: 0, attempts: 0, sends: [now - 10_000] }, now);
  assert.equal(r.ok, false);
  const five = [1, 2, 3, 4, 5].map((i) => now - i * 300_000);
  assert.equal(sendAllowed({ email: '', codeHash: '', expiresAt: 0, attempts: 0, sends: five }, now).ok, false);
  assert.equal(sendAllowed({ email: '', codeHash: '', expiresAt: 0, attempts: 0, sends: five.slice(0, 4) }, now).ok, true);
});

test('emails are normalised and validated; the mail contains the code', () => {
  assert.equal(normalizeEmail('  Me@Mail.COM '), 'me@mail.com');
  assert.ok(isEmail('me@mail.com'));
  assert.ok(!isEmail('me@mail'));
  const m = codeEmail('verify', '042317', 'fr');
  assert.match(m.subject, /042317/);
  assert.match(m.html, /042317/);
  assert.match(m.text, /10 minutes/);
});
