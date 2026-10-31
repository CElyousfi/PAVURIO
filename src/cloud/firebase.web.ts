/** Web build (previews only): no Firebase. Every cloud feature stays hidden. */
import type { CloudApi } from './types';

const noop = async () => ({ kind: 'error' as const, message: 'unavailable' });
export const cloud: CloudApi = {
  enabled: () => false,
  appleAvailable: async () => false,
  current: () => null,
  onUser: () => () => {},
  ensureGuest: async () => null,
  withApple: noop,
  withGoogle: noop,
  withEmail: noop,
  signOut: async () => {},
  deleteAccount: noop,
  readMeta: async () => null,
  upload: async () => {
    throw new Error('unavailable');
  },
  download: async () => [],
  refresh: async () => null,
  unlinkEmail: async () => {},
  sendCode: async () => ({ kind: 'error', message: 'unavailable' }),
  verifyCode: async () => ({ kind: 'error', message: 'unavailable' }),
  sendResetCode: async () => ({ kind: 'error', message: 'unavailable' }),
  resetPasswordWithCode: async () => ({ kind: 'error', message: 'unavailable' }),
  setMarketing: async () => {},
  crash: { setUser: () => {}, record: () => {}, log: () => {}, setEnabled: () => {} },
};
