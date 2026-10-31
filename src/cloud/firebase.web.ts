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
  resetPassword: async () => {},
  signOut: async () => {},
  deleteAccount: noop,
  readMeta: async () => null,
  upload: async () => {
    throw new Error('unavailable');
  },
  download: async () => [],
  crash: { setUser: () => {}, record: () => {}, log: () => {}, setEnabled: () => {} },
};
