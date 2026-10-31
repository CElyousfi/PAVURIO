export type Provider = 'apple' | 'google' | 'password' | 'anonymous';
/** verified: the email is confirmed (Google/Apple always; email+password after the 6-digit code) */
export type CloudUser = { uid: string; anonymous: boolean; email: string | null; providers: Provider[]; verified: boolean };

/** Result of an account action. `exists`: the Apple/Google/email account already belongs to another Pavurio account. */
export type AuthResult =
  | { kind: 'ok'; user: CloudUser }
  | { kind: 'cancelled' }
  | { kind: 'exists' }
  | { kind: 'reauth' }
  | { kind: 'error'; message: string; retryIn?: number };

export type BackupMeta = { gen: string; chunks: number; updatedAt: number; pets: number; schema: number; platform: string };

export interface CloudApi {
  /** Firebase is configured in this build (the Firebase files were present) and we are on a phone */
  enabled(): boolean;
  appleAvailable(): Promise<boolean>;
  current(): CloudUser | null;
  onUser(cb: (u: CloudUser | null) => void): () => void;
  ensureGuest(): Promise<CloudUser | null>;
  /** mode 'save' links the provider to the current (guest) account; 'signin' switches to that account */
  withApple(mode: 'save' | 'signin' | 'reauth'): Promise<AuthResult>;
  withGoogle(mode: 'save' | 'signin' | 'reauth'): Promise<AuthResult>;
  withEmail(mode: 'save' | 'signin' | 'reauth', email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  /** deletes the backup and the account; returns 'reauth' when the provider must confirm first */
  deleteAccount(): Promise<AuthResult>;
  readMeta(uid: string): Promise<BackupMeta | null>;
  upload(uid: string, chunks: string[], meta: Omit<BackupMeta, 'gen' | 'chunks'>): Promise<BackupMeta>;
  download(uid: string, meta: BackupMeta): Promise<string[]>;
  /** the user as Firebase knows it now (after a server-side change such as email verification) */
  refresh(): Promise<CloudUser | null>;
  /** remove the email+password sign-in from this account (to use another email) */
  unlinkEmail(): Promise<void>;
  /** 6-digit codes (Cloud Functions + Resend) */
  sendCode(lang: string): Promise<{ kind: 'sent'; email: string } | { kind: 'verified' } | Extract<AuthResult, { kind: 'error' }>>;
  verifyCode(code: string, marketing: boolean): Promise<{ kind: 'ok' } | Extract<AuthResult, { kind: 'error' }>>;
  sendResetCode(email: string, lang: string): Promise<{ kind: 'sent' } | Extract<AuthResult, { kind: 'error' }>>;
  resetPasswordWithCode(email: string, code: string, password: string): Promise<{ kind: 'ok' } | Extract<AuthResult, { kind: 'error' }>>;
  setMarketing(optIn: boolean, source: string): Promise<void>;
  crash: {
    setUser(uid: string | null): void;
    record(e: unknown, context?: string): void;
    log(message: string): void;
    setEnabled(on: boolean): void;
  };
}
