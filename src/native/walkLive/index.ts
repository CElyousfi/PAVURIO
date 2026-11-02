/** Web and other platforms: no lock-screen surface. Native builds use index.android.tsx / index.ios.tsx. */
import type { WalkLiveAction, WalkLiveProps } from './types';
export type { WalkLiveAction, WalkLiveProps } from './types';

export const walkLiveSupported = false;
export async function showWalkLive(_props: WalkLiveProps): Promise<void> {}
export async function endWalkLive(): Promise<void> {}
export async function readWalkLive(_walkId: string): Promise<WalkLiveProps | null> {
  return null;
}
export function onWalkLiveAction(_cb: (action: WalkLiveAction, walkId: string, at: number) => void): () => void {
  return () => {};
}
